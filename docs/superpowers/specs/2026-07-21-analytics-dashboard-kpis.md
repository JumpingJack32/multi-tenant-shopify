# Analytics Endpoints & Dashboard KPIs — Specification

> **Status:** Draft

---

## 1. Value

Add two high-impact analytics endpoints to the existing Analytics > Dashboard page: top products by revenue/units, and category revenue breakdown. Both use existing `order_items` data — no new schema or tracking required.

---

## 2. Architecture

```
Frontend (Analytics Dashboard) → GET /api/v1/analytics/top-products
                               → GET /api/v1/analytics/category-breakdown
                                      │
                                      ▼
                              FastAPI Backend
                                      │
                                      ▼
                     order_items → variants → products
                     Excludes cancelled/refunded orders
```

---

## 3. Endpoint: Top Products

### `GET /api/v1/analytics/top-products`

**Query Params:**

| Param        | Type      | Default   | Description                      |
| ------------ | --------- | --------- | -------------------------------- |
| `limit`      | int       | 5         | Max results (1–50)               |
| `start_date` | str (ISO) | —         | Filter orders after this date    |
| `end_date`   | str (ISO) | —         | Filter orders before this date   |
| `sort_by`    | str       | `revenue` | Sort field: `revenue` or `units` |

**SQL Logic:** Products can have multiple variants with different SKUs — group by product, not variant.

```sql
SELECT
  p.id AS product_id,
  p.name AS product_name,
  MIN(v.sku) AS primary_sku,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.total_price) AS total_revenue
FROM order_items oi
JOIN variants v ON oi.variant_id = v.id
JOIN products p ON v.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.tenant_id = :tid
  AND o.status NOT IN ('cancelled', 'refunded')
  AND (:start_date IS NULL OR o.created_at >= :start_date)
  AND (:end_date IS NULL OR o.created_at <= :end_date)
GROUP BY p.id, p.name
ORDER BY
  CASE WHEN :sort_by = 'units' THEN SUM(oi.quantity) ELSE SUM(oi.total_price) END DESC
LIMIT :limit
```

**Pydantic Schema:**

```python
class TopProductResponse(BaseModel):
    product_id: str
    product_name: str
    primary_sku: str | None = None
    units_sold: int
    total_revenue: int = Field(description="Revenue in pence")
```

**Response:**

```json
[
  {
    "product_id": "uuid",
    "product_name": "Urban Rucksack v2",
    "primary_sku": "URB-RUCK-GRY",
    "units_sold": 142,
    "total_revenue": 1263800
  }
]
```

Prices in pence (consistent with `total_price` on `OrderItem`). Frontend formats via `formatCurrency()`.

---

## 4. Endpoint: Category Breakdown

### `GET /api/v1/analytics/category-breakdown`

**Query Params:** `start_date`, `end_date` (same as above)

**SQL Logic:** Coalesce null category names to `"Uncategorized"` for chart safety.

```sql
SELECT
  COALESCE(c.id::text, 'uncategorized') AS category_id,
  COALESCE(c.name, 'Uncategorized') AS category_name,
  SUM(oi.quantity) AS units_sold,
  SUM(oi.total_price) AS total_revenue
FROM order_items oi
JOIN variants v ON oi.variant_id = v.id
JOIN products p ON v.product_id = p.id
LEFT JOIN categories c ON p.category_id = c.id
JOIN orders o ON oi.order_id = o.id
WHERE o.tenant_id = :tid
  AND o.status NOT IN ('cancelled', 'refunded')
  AND (:start_date IS NULL OR o.created_at >= :start_date)
  AND (:end_date IS NULL OR o.created_at <= :end_date)
GROUP BY c.id, c.name
ORDER BY total_revenue DESC
```

**Pydantic Schema:**

```python
class CategoryBreakdownResponse(BaseModel):
    category_id: str
    category_name: str
    units_sold: int
    total_revenue: int = Field(description="Revenue in pence")
    percentage_of_total: float
```

**Response:**

```json
[
  {
    "category_id": "uuid",
    "category_name": "Bags & Accessories",
    "units_sold": 380,
    "total_revenue": 2840000,
    "percentage_of_total": 58.5
  }
]
```

`percentage_of_total` computed as `round(cat_revenue / total_revenue * 100, 1) if total_revenue else 0.0` — guard against division by zero when date range has no orders.

---

## 5. Frontend

### API Client

Add `analytics.topProducts()` and `analytics.categoryBreakdown()` to the existing `api` object in `client.ts`.

### Hooks

Add `useTopProducts(params?)` and `useCategoryBreakdown(params?)` hooks.

### Dashboard Widgets

On the Analytics > Dashboard page, add two cards below the existing section cards:

**Top Products Card:**

- Toggle between Revenue / Units sort
- Horizontal bar chart (recharts `BarChart`) + ranked table
- Shows rank, product name, SKU, metric value, stock badge

**Category Breakdown Card:**

- Donut chart (recharts `PieChart`) with center total
- Hover tooltip with revenue + percentage
- Legend with category names + percentages

---

## 6. Files Changed

| File                                           | Change                                             |
| ---------------------------------------------- | -------------------------------------------------- |
| `services/backend-api/src/routes/analytics.py` | **New** — two endpoints + Pydantic schemas         |
| `services/backend-api/src/main.py`             | Register `analytics_router`                        |
| `apps/admin/src/lib/api/client.ts`             | Add `analytics` namespace                          |
| `apps/admin/src/features/analytics/hooks/`     | **New** — `useTopProducts`, `useCategoryBreakdown` |
| `apps/admin/src/app/(app)/dashboard/page.tsx`  | Add Top Products + Category Breakdown widgets      |
