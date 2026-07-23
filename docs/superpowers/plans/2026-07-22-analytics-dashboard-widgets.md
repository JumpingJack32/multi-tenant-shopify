# Analytics Dashboard Widgets — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-22-analytics-dashboard-widgets.md`

---

## Step 1 — Backend: New Analytics Endpoints

**File:** `services/backend-api/src/routes/analytics.py`

Add two endpoints using raw SQL with `text()` — the queries don't map cleanly to SQLModel ORM:

### `GET /analytics/customer-retention`

- Query params: `start_date`, `end_date`
- Returns monthly `{ month, new_customers, returning_customers, new_revenue, returning_revenue }`
- Uses `DATE_TRUNC` for month-level comparison (not timestamp-level)

### `GET /analytics/cart-abandonment`

- Query params: `start_date`, `end_date`
- Returns monthly `{ month, abandoned_carts, completed_carts }`
- Groups `carts` by status

---

## Step 2 — Frontend: Hooks

**File:** `apps/admin/src/features/analytics/hooks/use-analytics.ts`

Add two hooks:

- `useCustomerRetention(params?, tenantId?)`
- `useCartAbandonment(params?, tenantId?)`

---

## Step 3 — Frontend: Analytics Dashboard Page

**File:** `apps/admin/src/app/(app)/analytics/dashboards/page.tsx` (rewrite)

Replace current redirect with full layout:

Row 1: Period selector + 5 KPI cards (reuse `SectionCards`)
Row 2: Revenue trend (area chart, left) + Top 10 products (bar chart, right)
Row 3: Category breakdown (treemap/pie, left) + Customer retention (dual line, right)
Row 4: Cart abandonment (combo chart, left) + Top 20 orders (table, right)

Recharts components: `AreaChart`, `BarChart`, `PieChart`, `LineChart`, `ComposedChart`, `Treemap`

---

## Step 4 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter admin exec tsc --noEmit
pnpm --filter admin exec eslint .
pnpm vitest run --project admin
```
