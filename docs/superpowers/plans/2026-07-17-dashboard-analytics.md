# Dashboard & Analytics — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-dashboard-analytics.md`

---

## Step 1 — Backend: Enhanced Schema

**File:** `src/orm/schemas/dashboard.py`

Add `TimeSeriesPoint`, `net_revenue_mtd`, `net_revenue_prev_mtd`, `timeline` fields to `DashboardSummaryResponse`.

## Step 2 — Backend: Enhanced Admin Route

**File:** `src/routes/admin.py`

- Add `period` query param (7d/30d/90d/12m)
- Add `net_mtd` CTE to `_kpi_query` with tenant-scoped subquery on `order_items.tax_amount`
- Add timeline query with zero-fill backfill function
- Pass net revenue + timeline into response

## Step 3 — Frontend: Enhanced useDashboard Hook

**File:** `apps/admin/src/features/dashboard/hooks/use-dashboard.ts`

Pass `period` from `searchParams` to API call.

## Step 4 — Frontend: Net Revenue Card

**File:** `apps/admin/src/features/dashboard/components/section-cards.tsx`

Add a 5th stat card for net revenue with period-over-period delta.

## Step 5 — Frontend: Revenue Chart + Period Selector + Action Center

**File:** `apps/admin/src/app/(app)/dashboard/page.tsx`

- Replace Refresh button with period `<Select>`
- Insert `AreaChart` using Recharts via `@repo/ui/chart`
- Combine low stock + pending POs into a two-column Action Center

## Step 6 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
