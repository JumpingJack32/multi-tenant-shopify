# Performance Load Testing — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-performance-load-testing.md`

---

## Step 1 — Create Load Test Database

```bash
psql -U postgres -c "CREATE DATABASE multi_tenant_shopify_load_test;"
```

## Step 2 — Bulk Seed Script

**File:** `scripts/seed_load_test.py` (new)

Idempotent seed for a single tenant:

- 10,000 customers with addresses, tags, subscription statuses
- 500 products with ~1,000 variants
- 50,000 orders with ~150,000 order items (spread across 12 months)
- 30,000 timeline events, 5,000 store credit transactions
- Uses SQLAlchemy Core `insert()` for bulk operations (no ORM identity map)
- Respects `order.created_at >= customer.created_at` chronology
- Runs against `multi_tenant_shopify_load_test` database

## Step 3 — Benchmark Harness

**File:** `scripts/benchmark.py` (new)

For each of the 8 endpoints in the spec:

- Fire 100 requests, discard first 3 as warm-up
- Record min / max / avg / p(95) response time
- Print results table sorted by p95 descending

## Step 4 — Index Analysis & Tuning

If any endpoint exceeds 500ms p95, run `EXPLAIN ANALYZE` and add missing indexes.

Candidate indexes:

- `customers(tenant_id, total_spent)`
- `customers(tenant_id, email_subscription_status)`
- `orders(tenant_id, created_at)`
- `order_items(tenant_id, order_id)`

## Step 5 — Cleanup

```bash
doppler run -- uv run python scripts/benchmark.py  # Final run
psql -U postgres -c "DROP DATABASE multi_tenant_shopify_load_test;"
```

## Step 6 — Verify Dev Database Intact

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
```
