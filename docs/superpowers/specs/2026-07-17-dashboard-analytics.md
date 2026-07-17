# Dashboard & Analytics — Specification

> **Status:** Draft  
> **Prerequisites:** All prior phases (order lifecycle, tax engine, inventory)  
> **Strategy:** Enhance existing `GET /admin/dashboard/summary` and dashboard page — no new routes, no new models

---

## 1. Scope

Enhance the existing dashboard with three additions:

1. **Net revenue** (after tax) — new metric card using the `tax_amount` field from Phase 2
2. **Revenue time-series** — daily revenue/orders chart for the selected period
3. **Action center** — pending POs and low-stock alerts surfaced as urgency cards

No new database models, no new frontend routes, no new Recharts wrappers.

---

## 2. Backend: Enhanced `GET /admin/dashboard/summary`

**File:** `src/routes/admin.py`

### 2.1 Period Filter

Add an optional `period` query param:

```python
@router.get("/admin/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    period: str = Query("30d", regex="^(7d|30d|90d|12m)$"),
):
```

The `period` value adjusts the `created_at >=` filter in `_kpi_query`. Map: `7d` → 7 days, `30d` → 30 days, `90d` → 90 days, `12m` → 12 months.

### 2.2 Net Revenue

Add to `_kpi_query`:

```sql
COALESCE(SUM(total - COALESCE(tax_amount, 0)), 0)::BIGINT AS net_revenue_mtd
```

Requires joining `order_items` or using a subquery. Since `tax_amount` is on `OrderItem`, aggregate it per order:

```sql
net_mtd AS (
    SELECT COALESCE(SUM(o.total - COALESCE(oi.tax_total, 0)), 0)::BIGINT AS net_revenue_mtd
    FROM orders o
    LEFT JOIN (
        SELECT order_id, SUM(tax_amount) AS tax_total
        FROM order_items
        WHERE tenant_id = :tenant_id
        GROUP BY order_id
    ) oi ON o.id = oi.order_id
    WHERE o.tenant_id = :tenant_id AND o.created_at >= :start_date
)
```

### 2.3 Revenue Timeline

Add to the response — daily aggregation for the chart component:

```python
class TimeSeriesPoint(BaseModel):
    date: str  # YYYY-MM-DD
    revenue: int = 0
    orders: int = 0
```

Query:

```sql
SELECT
    DATE(created_at)::text AS date,
    COALESCE(SUM(total), 0)::BIGINT AS revenue,
    COUNT(*)::BIGINT AS orders
FROM orders
WHERE tenant_id = :tenant_id AND created_at >= :start_date
GROUP BY DATE(created_at)
ORDER BY date ASC
```

**Zero-filling:** The query only returns days with orders. To prevent Recharts from drawing straight lines across gaps, backfill missing days with zero values in Python before returning:

```python
from datetime import timedelta

def backfill_timeline(rows: list[dict], start_date, days_count):
    lookup = {r["date"]: r for r in rows}
    result = []
    for i in range(days_count):
        d = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        row = lookup.get(d, {"date": d, "revenue": 0, "orders": 0})
        result.append(TimeSeriesPoint(**row))
    return result
```

### 2.4 Enhanced Schema

**File:** `src/orm/schemas/dashboard.py`

```python
class TimeSeriesPoint(BaseModel):
    date: str
    revenue: int = 0
    orders: int = 0
```

Add to `DashboardSummaryResponse`:

```python
net_revenue_mtd: int = 0
net_revenue_prev_mtd: int = 0
timeline: list[TimeSeriesPoint] = []
```

---

## 3. Frontend: Enhanced Dashboard Page

**File:** `apps/admin/src/app/(app)/dashboard/page.tsx`

### 3.1 Period Selector

Replace the "Refresh" button with a period dropdown:

```tsx
<Select
  value={period}
  onValueChange={(v) => router.push(`/dashboard?period=${v}`)}
>
  <SelectItem value="7d">Last 7 days</SelectItem>
  <SelectItem value="30d">Last 30 days</SelectItem>
  <SelectItem value="90d">Last 90 days</SelectItem>
  <SelectItem value="12m">Last 12 months</SelectItem>
</Select>
```

### 3.2 Net Revenue Card

Add a 5th stat card between Gross Revenue and Total Orders displaying net revenue with period-over-period comparison.

### 3.3 Revenue Chart

Insert a Recharts `AreaChart` component between the metric cards and the fulfillment pipeline. Uses the existing `chart.tsx` wrapper from `@repo/ui`.

```tsx
<ChartContainer config={config} className="h-64">
  <AreaChart data={data.timeline}>
    <XAxis dataKey="date" />
    <YAxis />
    <ChartTooltip />
    <Area type="monotone" dataKey="revenue" fill="hsl(var(--primary))" />
  </AreaChart>
</ChartContainer>
```

### 3.4 Action Center

Replace the low stock alerts and pending PO stats with a combined two-column Action Center:

```
+-------------------------------------+-------------------------------------+
| ⚠️  Low Stock (14)                  | 📋  Pending POs (3)                  |
| Variant X — 2 left (threshold: 10)  | PO-20260716-001 — £1,200             |
| Variant Y — 0 left (OUT OF STOCK)   | PO-20260715-002 — £850               |
| Variant Z — 4 left (threshold: 10)  | PO-20260714-003 — £2,100             |
+-------------------------------------+-------------------------------------+
```

---

## 4. Files Changed

| File                                                             | Change                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/routes/admin.py`                                            | Add `period` param, net revenue query, timeline query       |
| `src/orm/schemas/dashboard.py`                                   | Add `TimeSeriesPoint`, `net_revenue_mtd/prev`, `timeline`   |
| `apps/admin/src/app/(app)/dashboard/page.tsx`                    | Add period selector, net revenue card, chart, action center |
| `apps/admin/src/features/dashboard/hooks/use-dashboard.ts`       | Pass `period` param to API                                  |
| `apps/admin/src/features/dashboard/components/section-cards.tsx` | Add net revenue card                                        |

---

## 5. Risks

| Risk                                             | Mitigation                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Order items with zero `tax_amount` (legacy data) | COALESCE to 0 — net revenue equals gross revenue for orders without tax data |
| Large date ranges (12m) with thousands of orders | Timeline grouped by day, limited to 365 rows max; index on `created_at`      |
| Chart readability with sparse data               | Return only days that have data; frontend can fill gaps if needed            |
