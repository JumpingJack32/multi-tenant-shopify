# Analytics Dashboard — Feasible Widgets Specification

> **Status:** Draft

---

## 1. Scope

Build a rich analytics dashboard at `/analytics/dashboards` using only data that already exists in the database. No new schemas, no new collection infrastructure. Half the widgets in the wireframe require data we don't track yet (geo, device type, marketing channel) — those are excluded.

---

## 2. Widget Inventory

| Widget                                | Backend Data                                            | Status           |
| ------------------------------------- | ------------------------------------------------------- | ---------------- |
| Date range + filter bar               | Existing period selector (7d/30d/90d/12m) + date inputs | ✅ Build         |
| KPI cards (revenue, orders, AOV)      | `dashboard_summary` endpoint                            | ✅ Reuse         |
| Revenue Trend chart                   | `dashboard_summary.timeline` (TimeSeriesPoint)          | ✅ Reuse         |
| Top 10 Products by Revenue            | `GET /analytics/top-products`                           | ✅ Build         |
| Category Revenue Breakdown            | `GET /analytics/category-breakdown`                     | ✅ Build treemap |
| Top 20 Orders by Value                | `dashboard_summary.recent_orders`                       | ✅ Build table   |
| Customer Retention (new vs returning) | `order_items` joined to `customers` by email            | 🟡 New endpoint  |
| Cart Abandonment vs Completed         | `carts` table with `status`, `completed_at`             | 🟡 New endpoint  |
| Revenue by Region                     | ❌ No geo data                                          | ❌ Future        |
| Orders by Device Type                 | ❌ No user-agent data                                   | ❌ Future        |
| Marketing Spend by Channel            | ❌ No marketing data                                    | ❌ Future        |
| Customer Acquisition by Channel       | ❌ No channel data                                      | ❌ Future        |

---

## 3. New Backend Endpoints

### 3a — `GET /analytics/customer-retention`

Returns monthly new vs returning customer revenue:

```sql
WITH customer_orders AS (
  SELECT c.email, o.created_at, o.total
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  JOIN customers c ON c.id = o.customer_id
  WHERE o.tenant_id = :tid AND o.status NOT IN ('cancelled', 'refunded')
),
first_purchase AS (
  SELECT email, MIN(created_at) AS first_date
  FROM customer_orders GROUP BY email
)
SELECT
  DATE_TRUNC('month', co.created_at) AS month,
  COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.email END) AS new_customers,
  COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.email END) AS returning_customers,
  SUM(CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END) AS new_revenue,
  SUM(CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END) AS returning_revenue
FROM customer_orders co
JOIN first_purchase fp ON co.email = fp.email
GROUP BY month ORDER BY month
```

**Response:** `{ month, new_customers, returning_customers, new_revenue, returning_revenue }[]`

### 3b — `GET /analytics/cart-abandonment`

Returns monthly abandoned vs completed cart counts:

```sql
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned_carts,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed_carts
FROM carts
WHERE tenant_id = :tid
  AND created_at >= :start_date
GROUP BY month ORDER BY month
```

**Response:** `{ month, abandoned_carts, completed_carts }[]`

---

## 4. Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Period Selector  [7d ▾]  [30d ▾]  [90d ▾]  [12m ▾]       │
├──────────────────────────┬──────────────────────────────────┤
│  KPI Cards (5 across)    │  KPI Cards (continued)           │
├──────────────────────────┼──────────────────────────────────┤
│  Revenue Trend           │  Top Products (bar)              │
│  (area chart)            │                                  │
├──────────────────────────┼──────────────────────────────────┤
│  Category Breakdown      │  Customer Retention              │
│  (treemap/pie)           │  (dual line chart)               │
├──────────────────────────┼──────────────────────────────────┤
│  Cart Abandonment        │  Top 20 Orders                   │
│  (combo chart)           │  (data table)                    │
└──────────────────────────┴──────────────────────────────────┘
```

Flexible grid — collapses to single column on mobile.

---

## 5. Existing Reusable Components

| Component                 | File                                              | Use              |
| ------------------------- | ------------------------------------------------- | ---------------- |
| `SectionCards`            | `features/dashboard/components/section-cards.tsx` | KPI row          |
| Revenue chart (AreaChart) | `app/(app)/dashboard/page.tsx`                    | Revenue trend    |
| `TopProductsWidget`       | `app/(app)/dashboard/page.tsx`                    | Top products bar |
| `CategoryWidget`          | `app/(app)/dashboard/page.tsx`                    | Category pie     |

These were built in the previous session and can be moved to the analytics page.

---

## 6. Files Changed

| File                                                       | Change                                                 |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `services/backend-api/src/routes/analytics.py`             | Add `customer-retention`, `cart-abandonment` endpoints |
| `apps/admin/src/app/(app)/analytics/dashboards/page.tsx`   | **Rewrite** — full analytics layout with all widgets   |
| `apps/admin/src/features/analytics/hooks/use-analytics.ts` | Add `useCustomerRetention`, `useCartAbandonment` hooks |
