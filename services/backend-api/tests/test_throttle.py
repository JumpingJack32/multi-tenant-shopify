"""Tests for in-memory rate limiter (standalone, no app import needed)."""

import asyncio
import sys
from pathlib import Path

# Ensure src is importable without the full app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest  # noqa: E402

from src.core.throttle import InMemoryRateLimiter  # noqa: E402


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
