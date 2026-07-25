# Analytics Reports, Live View & Custom Reports — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-22-analytics-reports-live-custom.md`

---

## Step 1 — Backend: Report Endpoints

**File:** `services/backend-api/src/routes/analytics.py`

Add four GET endpoints, all supporting `?format=csv` for streaming download:

- `GET /reports/sales` — daily/weekly/monthly aggregated sales
- `GET /reports/products` — product performance from order_items
- `GET /reports/customers` — customer LTV grouped by customer
- `GET /reports/carts` — cart conversion by day

**File:** `services/backend-api/src/orm/schemas/analytics.py`

Add Pydantic response models for each report type.

---

## Step 2 — Backend: Live View

**File:** `services/backend-api/src/routes/analytics.py`

- `GET /live-view` — returns active carts (10min window), today's revenue, recent activity feed

---

## Step 3 — Backend: Custom Reports

**File:** `services/backend-api/src/routes/analytics.py`

- `POST /custom-reports` — accepts dimensions/metrics/filters mapped against ALLOWED enums, constructs safe SQL via whitelist dictionary

---

## Step 4 — Frontend: Pages

- `apps/admin/src/app/(app)/analytics/reports/page.tsx` — tabbed interface (Sales, Products, Customers, Carts) with CSV download
- `apps/admin/src/app/(app)/analytics/live-view/page.tsx` — auto-polling counters + activity feed
- `apps/admin/src/app/(app)/analytics/custom-reports/page.tsx` — dimension/metric selector form + results table

---

## Step 5 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter admin exec tsc --noEmit
pnpm --filter admin exec eslint .
pnpm vitest run --project admin
```
