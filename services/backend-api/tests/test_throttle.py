"""Tests for in-memory and Redis rate limiters."""

import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest  # noqa: E402

from src.core.throttle import InMemoryRateLimiter, RedisRateLimiter, _create_limiter  # noqa: E402


# ── InMemoryRateLimiter ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_allows_requests_within_limit():
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
    for _ in range(3):
        assert await limiter.is_allowed("key") is True


@pytest.mark.asyncio
async def test_blocks_requests_exceeding_limit():
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
    for _ in range(3):
        await limiter.is_allowed("key")
    assert await limiter.is_allowed("key") is False


@pytest.mark.asyncio
async def test_independent_keys_are_isolated():
    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60)
    for _ in range(2):
        await limiter.is_allowed("key-a")
    assert await limiter.is_allowed("key-b") is True
    assert await limiter.is_allowed("key-a") is False


@pytest.mark.asyncio
async def test_remaining_decrements():
    limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
    assert await limiter.remaining("key") == 5
    await limiter.is_allowed("key")
    assert await limiter.remaining("key") == 4


@pytest.mark.asyncio
async def test_window_expires_after_duration():
    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=1)
    for _ in range(2):
        await limiter.is_allowed("key")
    assert await limiter.is_allowed("key") is False
    await asyncio.sleep(1.1)
    assert await limiter.is_allowed("key") is True


@pytest.mark.asyncio
async def test_reset_time_returns_future():
    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60)
    await limiter.is_allowed("key")
    reset = await limiter.reset_time("key")
    import time
    assert reset > time.time()


# ── Factory ────────────────────────────────────────────────────────────


def test_create_limiter_returns_in_memory_when_redis_disabled():
    with patch("src.core.throttle.settings.redis_enabled", False):
        limiter = _create_limiter(10, 60)
        assert isinstance(limiter, InMemoryRateLimiter)
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60


def test_create_limiter_returns_redis_when_enabled():
    with patch("src.core.throttle.settings.redis_enabled", True), \
         patch("src.core.throttle.settings.redis_url", "redis://localhost:6379"):
        limiter = _create_limiter(10, 60)
        assert isinstance(limiter, RedisRateLimiter)
        assert limiter.max_requests == 10
        assert limiter.window_seconds == 60


# ── RedisRateLimiter ───────────────────────────────────────────────────


@pytest.fixture
def mock_redis():
    mock = MagicMock()
    pipe = AsyncMock()
    pipe.incr = AsyncMock(return_value=1)
    pipe.ttl = AsyncMock(return_value=-1)
    pipe.execute = AsyncMock(return_value=[1, -1])
    mock.pipeline = MagicMock(return_value=pipe)
    mock.expire = AsyncMock()
    mock.get = AsyncMock(return_value=None)
    return mock


@pytest.mark.asyncio
async def test_redis_allows_first_request(mock_redis):
    with patch("src.core.throttle.RedisRateLimiter._client", AsyncMock(return_value=mock_redis)):
        limiter = RedisRateLimiter(max_requests=3, window_seconds=60)
        assert await limiter.is_allowed("key") is True
        mock_redis.expire.assert_awaited_once()


@pytest.mark.asyncio
async def test_redis_blocks_when_exceeded(mock_redis):
    pipe = mock_redis.pipeline.return_value
    pipe.execute = AsyncMock(return_value=[4, 30])
    with patch("src.core.throttle.RedisRateLimiter._client", AsyncMock(return_value=mock_redis)):
        limiter = RedisRateLimiter(max_requests=3, window_seconds=60)
        assert await limiter.is_allowed("key") is False


@pytest.mark.asyncio
async def test_redis_remaining(mock_redis):
    mock_redis.get = AsyncMock(return_value=b"2")
    with patch("src.core.throttle.RedisRateLimiter._client", AsyncMock(return_value=mock_redis)):
        limiter = RedisRateLimiter(max_requests=5, window_seconds=60)
        assert await limiter.remaining("key") == 3


@pytest.mark.asyncio
async def test_redis_reset_time_with_ttl(mock_redis):
    mock_redis.ttl = AsyncMock(return_value=30)
    with patch("src.core.throttle.RedisRateLimiter._client", AsyncMock(return_value=mock_redis)):
        limiter = RedisRateLimiter(max_requests=5, window_seconds=60)
        reset = await limiter.reset_time("key")
        import time
        assert reset > time.time()
        assert reset <= time.time() + 31
