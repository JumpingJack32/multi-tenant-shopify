# Analytics Dashboard KPIs — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-21-analytics-dashboard-kpis.md`

---

## Step 1 — Backend: Analytics Route

### 1a — Create schemas

**File:** `services/backend-api/src/orm/schemas/analytics.py` (new)

- `TopProductResponse` — product_id, product_name, primary_sku, units_sold, total_revenue
- `CategoryBreakdownResponse` — category_id, category_name, units_sold, total_revenue, percentage_of_total

### 1b — Create route

**File:** `services/backend-api/src/routes/analytics.py` (new)

- `GET /top-products` — SQLModel `select` + `func.sum`, dynamic `ORDER BY`, `MIN(v.sku)`, group by product
- `GET /category-breakdown` — SQLModel `select` + `func.sum`, `COALESCE` null categories, compute percentage with zero-guard
- Both join `OrderItem → Variant → Product → Category`, filter by tenant + non-cancelled orders + optional date range

### 1c — Register in main.py

```python
from src.routes.analytics import router as analytics_router
app.include_router(analytics_router, prefix="/api/v1/analytics")
```

---

## Step 2 — Frontend: API Client & Hooks

### 2a — API client

**File:** `apps/admin/src/lib/api/client.ts`

Add `analytics` namespace:

```typescript
analytics: {
  topProducts(params?, options?) { ... },
  categoryBreakdown(params?, options?) { ... },
}
```

### 2b — Hooks

**File:** `apps/admin/src/features/analytics/hooks/use-analytics.ts` (new)

- `useTopProducts(params?, tenantId?)` — query key `["analytics", "top-products", params, tid]`
- `useCategoryBreakdown(params?, tenantId?)` — query key `["analytics", "category-breakdown", params, tid]`

---

## Step 3 — Frontend: Dashboard Widgets

**File:** `apps/admin/src/app/(app)/analytics/dashboard/page.tsx` (new or use existing)

- **Top Products Card:** Horizontal `BarChart` + ranked table, toggle between Revenue/Units sort
- **Category Breakdown Card:** `PieChart` (donut) with center total + hover tooltip + legend

---

## Step 4 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter admin exec tsc --noEmit
pnpm vitest run --project admin
```
