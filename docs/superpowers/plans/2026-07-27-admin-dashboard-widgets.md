# Admin Dashboard Widgets — Implementation Plan

**Spec:** Admin Operational Control Center Widgets

---

## Step 1 — Dashboard API Endpoint

**File:** `src/routes/admin_dashboard.py`

- `GET /admin/dashboard/metrics` — single-flight response:
  - `revenue_30d` — sum of paid/fulfilled order totals (last 30 days)
  - `revenue_prev_30d` — sum for previous 30 days (for trend calc)
  - `orders_30d` — count of paid/fulfilled orders
  - `aov_30d` — average order value
  - `pending_fulfillments` — count of paid orders with unfulfilled status
  - `oldest_pending_date` — earliest unfulfilled order date
  - `low_stock_items` — variants where `inventory_stocks.quantity - reserved <= 10`

## Step 2 — Dashboard UI Widgets

**File:** `apps/admin/src/app/(app)/dashboard/page.tsx`

- Revenue card: gross revenue, order count, AOV with trend arrow
- Pending fulfillments card: count + oldest age + link to `/orders?status=paid`
- Low-stock card: list of items with quantity remaining + link to `/products/inventory/stock`

## Step 3 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
