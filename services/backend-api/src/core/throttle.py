import time
from collections import defaultdict
from typing import Protocol

from fastapi import HTTPException, Request, status


class RateLimiterProtocol(Protocol):
    async def is_allowed(self, key: str) -> bool: ...

    async def remaining(self, key: str) -> int: ...

    async def reset_time(self, key: str) -> float: ...


class InMemoryRateLimiter:
    """Sliding-window rate limiter — per-key, in-memory, no Redis needed."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def is_allowed(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        timestamps = self._buckets[key]
        timestamps[:] = [t for t in timestamps if t > cutoff]
        if len(timestamps) >= self.max_requests:
            return False
        timestamps.append(now)
        return True

    async def remaining(self, key: str) -> int:
        now = time.time()
        cutoff = now - self.window_seconds
        timestamps = self._buckets.get(key, [])
        active = [t for t in timestamps if t > cutoff]
        return max(0, self.max_requests - len(active))

    async def reset_time(self, key: str) -> float:
        timestamps = self._buckets.get(key, [])
        if timestamps:
            return timestamps[0] + self.window_seconds
        return time.time()


_storefront_limiter = InMemoryRateLimiter(max_requests=30, window_seconds=60)
_checkout_limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"{ip}:{request.url.path}"


def _rate_limit_response(retry_after: float, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "error": message,
            "retry_after": int(retry_after),
        },
        headers={"Retry-After": str(int(retry_after))},
    )


async def throttle_storefront(request: Request) -> None:
    key = _client_key(request)
    if not await _storefront_limiter.is_allowed(key):
        retry_after = await _storefront_limiter.reset_time(key) - time.time()
        raise _rate_limit_response(retry_after, "Too many requests. Please slow down.")


async def throttle_checkout(request: Request) -> None:
    key = _client_key(request)
    if not await _checkout_limiter.is_allowed(key):
        retry_after = await _checkout_limiter.reset_time(key) - time.time()
        raise _rate_limit_response(retry_after, "Too many checkout attempts. Please try again later.")
