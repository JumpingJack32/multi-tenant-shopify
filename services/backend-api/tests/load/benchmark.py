"""Load testing suite — PLP, PDP, and checkout benchmarks.

Usage:
    uv run python tests/load/benchmark.py              # default: 50 concurrent
    uv run python tests/load/benchmark.py --users 200   # 200 concurrent
    uv run python tests/load/benchmark.py --duration 60 --users 500
"""

import argparse
import asyncio
from dataclasses import dataclass, field
import random
import statistics
import time
from typing import Optional

import httpx

BASE_URL = "http://localhost:8000/api/v1"
TENANT_SLUG = "acme-corp"

# Pre-seeded product slugs from the seed database
PRODUCT_SLUGS = [
    "classic-leather-jacket",
    "wool-blend-coat",
    "silk-evening-gown",
    "cashmere-scarf",
]

CATEGORY_SLUGS = [
    "outerwear",
    "footwear",
    "accessories",
]


@dataclass
class Metrics:
    total: int = 0
    errors: int = 0
    latencies: list[float] = field(default_factory=list)

    @property
    def p50(self) -> float:
        return statistics.median(self.latencies) if self.latencies else 0

    @property
    def p95(self) -> float:
        if not self.latencies:
            return 0
        idx = int(len(self.latencies) * 0.95)
        return sorted(self.latencies)[idx]

    @property
    def p99(self) -> float:
        if not self.latencies:
            return 0
        idx = int(len(self.latencies) * 0.99)
        return sorted(self.latencies)[idx]

    @property
    def avg(self) -> float:
        return statistics.mean(self.latencies) if self.latencies else 0

    @property
    def rps(self) -> float:
        return self.total / (sum(self.latencies) / 1000) if self.latencies else 0


async def worker(
    client: httpx.AsyncClient,
    metrics: Metrics,
    stop_event: asyncio.Event,
) -> None:
    """Simulate a real shopper browsing the storefront."""
    while not stop_event.is_set():
        endpoint = random.choices(
            ["plp", "pdp", "cart", "checkout"],
            weights=[40, 40, 15, 5],
        )[0]

        url = f"{BASE_URL}/storefront/{TENANT_SLUG}"
        start = time.monotonic()

        try:
            if endpoint == "plp":
                cat = random.choice(CATEGORY_SLUGS)
                r = await client.get(f"{url}/products?category={cat}", timeout=10)
            elif endpoint == "pdp":
                slug = random.choice(PRODUCT_SLUGS)
                r = await client.get(f"{url}/products/{slug}", timeout=10)
            elif endpoint == "cart":
                r = await client.get(f"{url}/carts/nonexistent", timeout=5)
            else:
                r = await client.get(f"{url}/products", timeout=10)

            latency = (time.monotonic() - start) * 1000
            metrics.latencies.append(latency)
            metrics.total += 1
            if r.status_code >= 500:
                metrics.errors += 1

        except (httpx.TimeoutException, httpx.RequestError):
            metrics.total += 1
            metrics.errors += 1

        # Small random think time between requests (10-50ms)
        await asyncio.sleep(random.uniform(0.01, 0.05))


async def run_benchmark(users: int, duration: int) -> dict[str, Metrics]:
    print(f"\n{'='*60}")
    print(f"  Load Test: {users} concurrent users, {duration}s duration")
    print(f"{'='*60}\n")

    limits = httpx.Limits(max_connections=users * 2, max_keepalive_connections=users)
    async with httpx.AsyncClient(limits=limits) as client:
        metrics = Metrics()
        stop_event = asyncio.Event()

        workers = [asyncio.create_task(worker(client, metrics, stop_event)) for _ in range(users)]

        for remaining in range(duration, 0, -5):
            print(f"  {remaining}s remaining — requests: {metrics.total}, errors: {metrics.errors}")
            await asyncio.sleep(5)

        stop_event.set()
        await asyncio.gather(*workers, return_exceptions=True)

    return {"combined": metrics}


def print_report(results: dict[str, Metrics], users: int) -> None:
    print(f"\n{'='*60}")
    print(f"  BENCHMARK REPORT — {users} concurrent users")
    print(f"{'='*60}")
    for name, m in results.items():
        print(f"\n  [{name}]")
        print(f"    Total requests:  {m.total}")
        print(f"    Errors:          {m.errors} ({m.errors/m.total*100:.1f}%)" if m.total else "     Errors:          0")
        print(f"    Avg latency:     {m.avg:.1f} ms")
        print(f"    P50 latency:     {m.p50:.1f} ms")
        print(f"    P95 latency:     {m.p95:.1f} ms")
        print(f"    P99 latency:     {m.p99:.1f} ms")
        print(f"    Est. RPS:        {m.rps:.0f}")
    print()


def main() -> None:
    parser = argparse.ArgumentParser(description="Storefront load test")
    parser.add_argument("--users", type=int, default=50, help="Concurrent users")
    parser.add_argument("--duration", type=int, default=30, help="Test duration (seconds)")
    args = parser.parse_args()

    results = asyncio.run(run_benchmark(args.users, args.duration))
    print_report(results, args.users)


if __name__ == "__main__":
    main()
