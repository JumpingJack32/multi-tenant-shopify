from collections import defaultdict
import time
from typing import Protocol

from fastapi import HTTPException, Request, status

from src.config import settings


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


class RedisRateLimiter:
    """Redis-backed sliding-window rate limiter — works across instances."""

    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._prefix = "rate:"

    async def _client(self):
        from src.core.cache import redis_client

        return redis_client.client

    async def is_allowed(self, key: str) -> bool:
        r = await self._client()
        pipe = r.pipeline()
        await pipe.incr(f"{self._prefix}{key}")
        await pipe.ttl(f"{self._prefix}{key}")
        results = await pipe.execute()
        count = int(results[0])
        ttl = int(results[1])
        if count == 1 or ttl == -1:
            await r.expire(f"{self._prefix}{key}", self.window_seconds)
        return count <= self.max_requests

    async def remaining(self, key: str) -> int:
        r = await self._client()
        val = await r.get(f"{self._prefix}{key}")
        if val is None:
            return self.max_requests
        return max(0, self.max_requests - int(val))

    async def reset_time(self, key: str) -> float:
        r = await self._client()
        ttl = await r.ttl(f"{self._prefix}{key}")
        if ttl and ttl > 0:
            return time.time() + ttl
        return time.time()


def _create_limiter(max_requests: int, window_seconds: int) -> RateLimiterProtocol:
    if settings.redis_enabled and settings.redis_url:
        return RedisRateLimiter(max_requests, window_seconds)
    return InMemoryRateLimiter(max_requests, window_seconds)


_storefront_limiter = _create_limiter(max_requests=30, window_seconds=60)
_checkout_limiter = _create_limiter(max_requests=10, window_seconds=60)


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
