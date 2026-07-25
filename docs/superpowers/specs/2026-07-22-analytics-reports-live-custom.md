# Analytics Reports, Live View & Custom Reports — Specification

> **Status:** Draft

---

## 1. Value

Add three analytics pages using only first-party database data (orders, customers, carts, products). No external tracking services needed. These pages give tenants financial auditing, operational pulse checks, and ad-hoc data exploration.

---

## 2. Reports (`/analytics/reports`)

Four report tabs displayed as filterable tables with download (CSV) support. All report endpoints accept `?format=csv` to return a `StreamingResponse` with `Content-Disposition: attachment` — reuses the existing CSV streaming pattern from customer exports.

### 2a — Sales Report

**Backend:** `GET /analytics/reports/sales`

| Column | Source | Description |
|--------|--------|-------------|
| Period | `DATE_TRUNC('day/week/month', created_at)` | Time bucket |
| Gross Sales | `SUM(total)` before discounts | Total revenue |
| Discounts | `SUM(discount)` | Total discounts applied |
| Net Sales | `SUM(total - discount)` | Revenue after discounts |
| Tax | `SUM(tax)` | Total tax collected |
| Shipping | `SUM(shipping)` | Total shipping charged |
| Refunds | `SUM(total)` WHERE status = 'refunded' | Refunded amount |
| Order Count | `COUNT(*)` | Number of orders |

**Query params:** `start_date`, `end_date`, `group_by` (day/week/month), `status`

### 2b — Product Performance

**Backend:** `GET /analytics/reports/products`

Joins `order_items` → `products` → `categories`.

| Column | Source |
|--------|--------|
| Product Name | `products.name` |
| SKU | `variants.sku` (MIN) |
| Category | `categories.name` |
| Units Sold | `SUM(order_items.quantity)` |
| Total Revenue | `SUM(order_items.total_price)` |
| Avg Price | `AVG(order_items.unit_price)` |
| Times Ordered | `COUNT(DISTINCT order_id)` |

### 2c — Customer Lifetime Value

**Backend:** `GET /analytics/reports/customers`

Groups `orders` by `customer_id`.

| Column | Source |
|--------|--------|
| Customer Email | `customers.email` |
| First Order | `MIN(orders.created_at)` |
| Last Order | `MAX(orders.created_at)` |
| Order Count | `COUNT(orders.id)` |
| Total Spent | `SUM(orders.total)` |
| Avg Order Value | `AVG(orders.total)` |
| Status | `customers.email_subscription_status` |

### 2d — Cart Conversion

**Backend:** `GET /analytics/reports/carts`

| Column | Source |
|--------|--------|
| Period | `DATE_TRUNC('day', created_at)` |
| Active Carts | `COUNT(*) FILTER (WHERE status = 'active')` |
| Abandoned | `COUNT(*) FILTER (WHERE status = 'abandoned')` |
| Completed | `COUNT(*) FILTER (WHERE status = 'completed')` |
| Conversion Rate | `COALESCE(ROUND(completed::numeric / NULLIF(abandoned + completed, 0) * 100, 2), 0.00)` |

---

## 3. Live View (`/analytics/live-view`)

Operational pulse check using recent database timestamps.

**Backend:** `GET /analytics/live-view`

Returns three data points:

```json
{
  "active_carts": { "count": 12, "updated_at": "2026-07-22T15:00:00Z" },
  "today_ticker": { "revenue": 1280000, "orders": 34, "date": "2026-07-22" },
  "recent_activity": [
    { "type": "order_created", "description": "Order SF-1234 placed", "created_at": "..." },
    { "type": "cart_abandoned", "description": "Cart #567 abandoned", "created_at": "..." },
  ]
}
```

- **Active carts:** `SELECT COUNT(*) FROM carts WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '10 minutes'` (requires index on `(tenant_id, updated_at)`)
- **Today's ticker:** `SELECT SUM(total), COUNT(*) FROM orders WHERE created_at >= CURRENT_DATE AND status NOT IN ('cancelled', 'refunded')` (requires index on `(tenant_id, created_at)`)
- **Recent activity:** Union of recent `orders.created_at` and `carts.updated_at` events, sorted DESC, limit 20

Frontend: Auto-polls every 30 seconds. Shows counters for active carts and today's revenue, plus a scrollable activity feed with type icons.

---

## 4. Custom Reports (`/analytics/custom-reports`)

SQL-driven report builder. Frontend lets users pick dimensions, metrics, and filters, then constructs a query.

**Backend:** `POST /analytics/custom-reports`

```json
{
  "dimensions": ["category", "order_status"],
  "metrics": ["total_revenue", "order_count", "avg_order_value"],
  "filters": { "start_date": "2026-01-01", "end_date": "2026-07-22", "min_total": 1000 },
  "group_by": ["category", "order_status"],
  "order_by": { "column": "total_revenue", "direction": "desc" },
  "limit": 50
}
```

The backend validates the requested dimensions/metrics against a whitelist dictionary, not raw SQL interpolation. Each allowed key maps to a pre-validated SQL expression:

```python
ALLOWED_METRICS = {
    "total_revenue": func.sum(OrderItem.total_price),
    "order_count": func.count(Order.id.distinct()),
    "avg_order_value": func.avg(Order.total),
    "units_sold": func.sum(OrderItem.quantity),
    "customer_count": func.count(Customer.email.distinct()),
}

ALLOWED_DIMENSIONS = {
    "category": Category.name,
    "order_status": Order.status,
    "product_name": Product.name,
    "customer_email": Customer.email,
    "day": func.date_trunc('day', Order.created_at),
    "month": func.date_trunc('month', Order.created_at),
}

ALLOWED_FILTERS = {"start_date", "end_date", "min_total", "max_total", "status", "category_id"}
```

Returns rows as an array of key-value objects.

---

## 5. Files Changed

| File | Change |
|------|--------|
| `services/backend-api/src/routes/analytics.py` | Add `/reports/sales`, `/reports/products`, `/reports/customers`, `/reports/carts`, `/live-view`, `/custom-reports` |
| `services/backend-api/src/orm/schemas/analytics.py` | Add response schemas for all report types |
| `apps/admin/src/app/(app)/analytics/reports/page.tsx` | **Rewrite** — tabbed report interface |
| `apps/admin/src/app/(app)/analytics/live-view/page.tsx` | **Rewrite** — live dashboard with auto-poll |
| `apps/admin/src/app/(app)/analytics/custom-reports/page.tsx` | **Rewrite** — report builder form |
| `apps/admin/src/features/analytics/hooks/use-analytics.ts` | Add report hooks |
