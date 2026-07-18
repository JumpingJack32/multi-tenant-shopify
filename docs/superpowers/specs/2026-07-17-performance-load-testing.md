# Performance Load Testing — Specification

> **Status:** Draft  
> **Goal:** Seed 10k+ records, benchmark key queries, add missing indexes

---

## 1. Why

All endpoints pass with 25 seed customers. Real traffic will have 1k–10k customers with hundreds of thousands of orders. Queries that are fast at 25 rows may degrade catastrophically at 10k. We need to find and fix those before they hit production.

---

## 2. Seed Script: `scripts/seed_load_test.py`

**New file** — standalone script using the same random seed pattern as `seed_database.py`.

Creates for a single tenant:

| Entity          | Count    | Notes                                                             |
| --------------- | -------- | ----------------------------------------------------------------- |
| Customers       | 10,000   | Names, emails, addresses, random subscription statuses            |
| Products        | 500      | With 1-3 variants each → ~1,000 variants                          |
| Orders          | 50,000   | Spread across customers and products, random dates over 12 months |
| Order items     | ~150,000 | 1-5 items per order                                               |
| Timeline events | ~30,000  | 1-3 per customer                                                  |
| Store credit tx | ~5,000   | For customers with positive credit                                |

**Target total:** ~200k rows across all tables.

Runs in a single transaction, commits at the end.

**Memory safety:** Do NOT use `db.add(obj)` in a loop — 150k ORM objects in the identity map will OOM the process. Instead, use SQLAlchemy Core bulk inserts:

```python
from sqlalchemy import insert

# Instead of: for item in items: db.add(OrderItem(...))
# Do:
await db.execute(
    insert(OrderItem),
    [{"order_id": oid, "quantity": qty, ...} for ... in batch],
)
```

**Customer chronology:** Ensure `order.created_at >= customer.created_at` in the generation loop to keep cohort tracking consistent.

---

## 3. Benchmark Commands

**File:** `scripts/benchmark.py` (new)

For each endpoint, record min/max/avg response time over 10 requests:

| Endpoint                                                                | What it tests            |
| ----------------------------------------------------------------------- | ------------------------ |
| `GET /customers/?page=1&per_page=20`                                    | Paginated list           |
| `GET /customers/?search=john&page=1`                                    | Search + pagination      |
| `GET /customers/?status=subscribed&sort_by=total_spent&sort_order=desc` | Filter + sort            |
| `GET /customers/?min_spent=50000&tag=VIP&location=London`               | Multi-filter             |
| `GET /customers/export`                                                 | Streaming CSV generation |
| `GET /admin/dashboard/summary?period=12m`                               | Dashboard CTE            |
| `GET /admin/dashboard/summary?period=30d`                               | Dashboard MTD            |
| `GET /segments/`                                                        | Segment list             |

**Statistical reliability:** Run **100 iterations** per endpoint, discard the first 3 as warm-up (cold cache / connection pool spin-up). Report min, max, avg, and p95 over the remaining 97 samples.

**Threshold:** Each endpoint should respond in under 500ms at p95. Any endpoint exceeding 1s needs index analysis.

---

## 4. Index Analysis

After benchmarks, check `EXPLAIN ANALYZE` for slow queries and add missing indexes:

| Candidate Index                          | Table         | Why                        |
| ---------------------------------------- | ------------- | -------------------------- |
| `(tenant_id, total_spent)`               | `customers`   | Segment filter `min_spent` |
| `(tenant_id, email_subscription_status)` | `customers`   | Status filter              |
| `(tenant_id, created_at)`                | `orders`      | Dashboard time-series      |
| `(tenant_id, order_id)`                  | `order_items` | Join performance           |

---

## 5. Cleanup

The load test seed is on a **separate database** (`multi_tenant_shopify_load_test`) or uses `SET session_replication_role = replica` to bypass triggers. It is never run against the dev or test database.

At end of session, run `DROP DATABASE multi_tenant_shopify_load_test`.

---

## 6. Files Changed

| File                        | Change                                |
| --------------------------- | ------------------------------------- |
| `scripts/seed_load_test.py` | **New** — bulk data generator         |
| `scripts/benchmark.py`      | **New** — timing harness              |
| `src/orm/models/order.py`   | Add indexes (if benchmarks show need) |

---

## 7. Risks

| Risk                                   | Mitigation                                                               |
| -------------------------------------- | ------------------------------------------------------------------------ |
| Load test runs against dev database    | Separate database, documented in `DEVELOPMENT_SAFETY.md`                 |
| 150k order items takes hours to insert | Batch inserts with multi-value `VALUES`; single transaction              |
| Indexes added don't help               | Test with `EXPLAIN ANALYZE` before adding; only add if seq scan detected |
