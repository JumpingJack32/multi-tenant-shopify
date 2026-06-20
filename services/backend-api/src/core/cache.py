import time
from typing import Any
from uuid import UUID

from redis.asyncio import Redis

from src.config import settings

# In-memory JWT blacklist fallback when Redis is not available
_jwt_blacklist: dict[str, float] = {}


class RedisClient:
    _instance: "RedisClient | None" = None
    _redis: Redis | None = None

    def __new__(cls) -> "RedisClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    @property
    def client(self) -> Redis:
        if self._redis is None:
            if not settings.redis_enabled or not settings.redis_url:
                raise RuntimeError("Redis is disabled or not configured")
            self._redis = Redis.from_url(
                settings.redis_url,
                decode_responses=False,
                socket_keepalive=True,
                socket_keepalive_options={},
            )
        return self._redis

    async def ping(self) -> bool:
        try:
            result = await self.client.ping()
            return result is True
        except Exception:
            return False

    async def close(self) -> None:
        if self._redis:
            await self._redis.close()
            self._redis = None


redis_client = RedisClient()


# ── Tier 1: Rate Limiting ───────────────────────────────────────────────


async def check_rate_limit(key: str, limit: int = 60, window: int = 60) -> bool:
    """Check if a request is within rate limits. Returns True if allowed."""
    pipe = redis_client.client.pipeline()
    pipe.incr(f"rate:{key}")
    pipe.ttl(f"rate:{key}")
    results = await pipe.execute()

    count = results[0]
    ttl = results[1]

    if count == 1:
        await redis_client.client.expire(f"rate:{key}", window)
        ttl = window

    if count > limit:
        return False

    await redis_client.client.expire(f"rate:{key}", ttl)
    return True


# ── Tier 1: Response Caching ────────────────────────────────────────────


async def cache_get(key: str) -> Any | None:
    """Get a cached value."""
    try:
        data = await redis_client.client.get(key)
        if data:
            import json
            return json.loads(data)
    except Exception:
        pass
    return None


async def cache_set(key: str, value: Any, ttl: int = 3600) -> None:
    """Set a cached value with TTL."""
    try:
        import json
        await redis_client.client.setex(key, ttl, json.dumps(value))
    except Exception:
        pass


async def cache_delete(key: str) -> None:
    """Invalidate a cached value."""
    try:
        await redis_client.client.delete(key)
    except Exception:
        pass


async def cache_delete_pattern(pattern: str) -> None:
    """Invalidate all cached values matching a pattern."""
    try:
        keys = await redis_client.client.keys(pattern)
        if keys:
            await redis_client.client.delete(*keys)
    except Exception:
        pass


# ── Tier 1: JWT Blacklist ───────────────────────────────────────────────


async def blacklist_jwt(jti: str, exp: int) -> None:
    """Add a JWT JTI to the blacklist until expiration."""
    try:
        if not settings.redis_enabled or not settings.redis_url:
            ttl = max(exp - int(time.time()), 0)
            if ttl > 0:
                _jwt_blacklist[jti] = exp
            return
        ttl = max(exp - int(time.time()), 0)
        if ttl > 0:
            await redis_client.client.setex(f"jwt:blacklist:{jti}", ttl, "1")
    except Exception:
        ttl = max(exp - int(time.time()), 0)
        if ttl > 0:
            _jwt_blacklist[jti] = exp


async def is_jwt_blacklisted(jti: str) -> bool:
    """Check if a JWT JTI is blacklisted."""
    if jti in _jwt_blacklist:
        if time.time() < _jwt_blacklist[jti]:
            return True
        else:
            del _jwt_blacklist[jti]
            return False
    try:
        if not settings.redis_enabled or not settings.redis_url:
            return False
        result = await redis_client.client.exists(f"jwt:blacklist:{jti}")
        return result == 1
    except Exception:
        return False


# ── Tier 2: Cart / Inventory Reservation ─────────────────────────────────


async def reserve_inventory(variant_id: UUID, quantity: int, reservation_id: UUID, ttl: int = 900) -> bool:
    """Reserve inventory for a cart session. Returns True if successful."""
    key = f"reserve:{variant_id}"
    current = await redis_client.client.get(key)
    current_qty = int(current) if current else 0

    pipe = redis_client.client.pipeline()
    pipe.set(key, current_qty + quantity, ex=ttl)
    pipe.set(f"reserve:{variant_id}:{reservation_id}", quantity, ex=ttl)
    results = await pipe.execute()

    return results[0] is not None


async def release_inventory(variant_id: UUID, reservation_id: UUID, quantity: int) -> None:
    """Release an inventory reservation."""
    key = f"reserve:{variant_id}"
    pipe = redis_client.client.pipeline()
    pipe.decrby(key, quantity)
    pipe.delete(f"reserve:{variant_id}:{reservation_id}")
    await pipe.execute()


# ── Tier 2: Idempotency Keys ────────────────────────────────────────────


async def store_idempotency_key(key: str, result: Any, ttl: int = 86400) -> None:
    """Store an idempotency key result."""
    try:
        import json
        await redis_client.client.setex(f"idem:{key}", ttl, json.dumps(result))
    except Exception:
        pass


async def get_idempotency_key(key: str) -> Any | None:
    """Retrieve a stored idempotency key result."""
    try:
        data = await redis_client.client.get(f"idem:{key}")
        if data:
            import json
            return json.loads(data)
    except Exception:
        pass
    return None


# ── Tier 2: Distributed Locks ───────────────────────────────────────────


async def acquire_lock(resource: str, owner: str, ttl: int = 30) -> bool:
    """Acquire a distributed lock. Returns True if successful."""
    lock_key = f"lock:{resource}"
    result = await redis_client.client.set(lock_key, owner, nx=True, ex=ttl)
    return result is not None


async def release_lock(resource: str, owner: str) -> bool:
    """Release a distributed lock using Lua script for atomicity."""
    lua = """
    if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
    else
        return 0
    end
    """
    lock_key = f"lock:{resource}"
    result = await redis_client.client.eval(lua, 1, lock_key, owner)
    return result == 1
