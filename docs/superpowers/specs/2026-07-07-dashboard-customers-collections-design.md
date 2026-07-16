# Dashboard, Customers & Collections — Design Spec

**Date:** 2026-07-07  
**Branch:** Sequential single-branch implementation (main...feature/dashboard-customers-collections)

## Overview

Three independent subsystems implemented sequentially on a single branch:

1. **Dashboard** — real-time operational metrics with MTD comparisons
2. **Customer Management** — admin directory + detail profile
3. **Collections** — many-to-many product grouping with editorial landing pages

Implementation sequence: Database → Backend → Admin UI → Storefront.

---

## Task 1: Database (Alembic Migrations)

### Migration 0005 — Customers Table

The `Customer` model already exists in `src/orm/models/order.py` but has no migration. This migration creates the `customers` and `customer_addresses` tables with RLS.

**Currency convention:** All monetary values stored as `BIGINT` (minor units / pence). API returns cents. UI divides by 100 for display: `£{(n / 100).toFixed(2)}`.

**`customers` table columns:**

- `id` UUID PK
- `tenant_id` UUID FK → tenants (NOT NULL)
- `email` VARCHAR(255) NOT NULL
- `first_name` VARCHAR(100) NULL
- `last_name` VARCHAR(100) NULL
- `phone` VARCHAR(50) NULL
- `is_verified` BOOLEAN DEFAULT false
- `total_orders` INTEGER DEFAULT 0
- `total_spent` BIGINT DEFAULT 0 — in cents, synced via DB trigger
- `refunded_total` BIGINT DEFAULT 0 — in cents, synced via DB trigger
- `last_order_at` TIMESTAMPTZ NULL
- `created_at`, `updated_at` TIMESTAMPTZ

**Index:** `ix_customers_tenant_email` on `(tenant_id, email)`  
**RLS:** `tenant_id = current_setting('app.current_tenant_id')::uuid`  
⚠ **Pool safety — CRITICAL:** Every request MUST `RESET app.current_tenant_id` after the transaction to prevent cross-tenant leaks via connection reuse. **Do NOT use `@app.on_event("shutdown")`** — that fires only on server close, not per-request.

**Correct approach:** Reset in the FastAPI DB dependency `yield` block (or SQLAlchemy `after_execute` event):

```python
async def get_db():
    async with Session() as session:
        try:
            yield session
        finally:
            await session.execute(text("RESET app.current_tenant_id"))
```

This ensures the session variable is purged before the connection returns to the pool, regardless of whether the request succeeded or failed.

**Customer denormalization sync — DB trigger:**

Create a trigger function `sync_customer_agg()` on the `orders` table:

```sql
CREATE OR REPLACE FUNCTION sync_customer_agg()
RETURNS TRIGGER AS $$
DECLARE
  agg RECORD;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.payment_status IN ('PAID', 'REFUNDED') THEN
    -- Use absolute aggregation to avoid race condition from concurrent inserts
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0) AS paid,
      COALESCE(SUM(total) FILTER (WHERE payment_status = 'REFUNDED'), 0) AS refunded
    INTO agg
    FROM orders
    WHERE customer_id = NEW.customer_id AND tenant_id = NEW.tenant_id;

    UPDATE customers
    SET total_orders = agg.cnt,
        total_spent = agg.paid,
        refunded_total = agg.refunded,
        last_order_at = GREATEST(last_order_at, NEW.created_at)
    WHERE id = NEW.customer_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recalculate from scratch on payment_status change (handles refunds, cancellations)
    UPDATE customers
    SET total_orders = sub.cnt,
        total_spent = sub.paid,
        refunded_total = sub.refunded
    FROM (
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'PAID') as cnt,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0) as paid,
        COALESCE(SUM(total) FILTER (WHERE payment_status = 'REFUNDED'), 0) as refunded
      FROM orders
      WHERE customer_id = NEW.customer_id AND tenant_id = NEW.tenant_id
    ) sub
    WHERE id = NEW.customer_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE customers
    SET total_orders = total_orders - 1,
        total_spent = total_spent - CASE WHEN OLD.payment_status = 'PAID' THEN OLD.total ELSE 0 END
    WHERE id = OLD.customer_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

Triggers on `orders` table: `AFTER INSERT OR UPDATE OF payment_status, total OR DELETE FOR EACH ROW EXECUTE FUNCTION sync_customer_agg()`.

**`customer_addresses` table columns:**

- `id` UUID PK
- `customer_id` UUID FK → customers (ON DELETE CASCADE)
- `tenant_id` UUID FK → tenants (NOT NULL)
- `address_type` VARCHAR(50) DEFAULT 'shipping' — values: 'shipping', 'billing'
- `line1`, `line2`, `city`, `province`, `postal_code`, `country` VARCHAR fields
- `is_default` BOOLEAN DEFAULT false
- `created_at`, `updated_at` TIMESTAMPTZ

**Constraints:** Partial unique index `uq_customer_default_address` on `(customer_id, address_type) WHERE is_default = true` — prevents multiple defaults of same type per customer.

### Migration 0006 — Collections + Junction Table

**`collections` table:**

- `id` UUID PK
- `tenant_id` UUID FK → tenants (NOT NULL)
- `name` VARCHAR(255) NOT NULL
- `slug` VARCHAR(255) NOT NULL
- `description` TEXT NULL
- `hero_image_url` VARCHAR(2048) NULL (Cloudinary public_id)
- `hero_image_alt` VARCHAR(500) NULL
- `sort_order` INTEGER DEFAULT 0
- `is_active` BOOLEAN DEFAULT true
- `created_at`, `updated_at` TIMESTAMPTZ

**Constraints:** UNIQUE `(tenant_id, slug)`  
**Index:** `ix_collections_tenant_active` on `(tenant_id, is_active)`  
**RLS:** `tenant_id = current_setting('app.current_tenant_id')::uuid`

**`product_collections` junction table:**

- `product_id` UUID FK → products (ON DELETE CASCADE)
- `collection_id` UUID FK → collections (ON DELETE CASCADE)
- `tenant_id` UUID FK → tenants (NOT NULL) — for RLS performance
- `sort_order` INTEGER DEFAULT 0 (for ordering within collection)
- `created_at` TIMESTAMPTZ

**PK:** Composite `(product_id, collection_id)`  
**RLS:** `tenant_id = current_setting('app.current_tenant_id')::uuid`

**Soft deletes:** Collections use `is_active` for soft deletion — no hard `DELETE` endpoint. Admin UI toggles `is_active = false`. The `DELETE /collections/{id}` route sets `is_active = false` and returns 200 (idempotent — if already inactive, still returns 200 with `{"status": "already_inactive"}`). Product associations are preserved so re-activation is instant. **Do not return 404** — the resource still exists in the database; a 404 would break frontend query cache invalidation.

---

## Task 2: Backend Cohesion Layer

### API Route Structure

All new routes follow existing conventions (tenant-scoped, auth-protected).

#### Dashboard Aggregator

```
GET /api/v1/admin/dashboard/summary
```

Returns a single unified payload:

```json
{
  "revenue_mtd": 4599000,
  "revenue_total": 28450000,
  "revenue_prev_mtd": 3820000,
  "orders_mtd": 142,
  "orders_total": 1047,
  "orders_prev_mtd": 118,
  "aov": 27173,
  "active_customers": 89,
  "active_customers_prev": 74,
  "fulfillment": {
    "unfulfilled": 12,
    "processing": 8,
    "shipped": 5,
    "delivered": 117
  },
  "low_stock": [
    {
      "variant_id": "...",
      "product_name": "Trench Coat",
      "sku": "TC-001",
      "quantity": 2,
      "threshold": 5
    }
  ],
  "recent_orders": [
    {
      "id": "...",
      "order_number": "ORD-042",
      "customer_name": "Jane Smith",
      "total": 14999,
      "status": "confirmed",
      "created_at": "2026-07-07T14:30:00Z"
    }
  ]
}
```

All monetary values in cents (BIGINT). UI divides by 100 for display.

Implementation: **4 parallel queries** using `asyncio.gather()` — NOT a monolithic CTE:

1. **KPIs query** — revenue MTD/prev MTD, orders MTD/prev MTD, active customers MTD/prev MTD, AOV
2. **Fulfillment query** — COUNT + GROUP BY status WHERE status IN ('pending','confirmed','shipped','delivered')
3. **Low stock query** — SELECT from variants WHERE inventory_quantity <= safety_threshold (threshold = 5), JOIN products for name
4. **Recent orders query** — SELECT last 5 orders with customer name JOIN, ORDER BY created_at DESC

All four run in parallel via `asyncio.gather()`. The aggregator endpoint assembles the combined response.

**MTD logic (UTC timezone — canonical reporting tz):**

- Current MTD: `created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')`
- Previous MTD (same relative day range):
  ```sql
  created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
  AND created_at < LEAST(
    date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
      + EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') * INTERVAL '1 day',
    date_trunc('month', NOW() AT TIME ZONE 'UTC')
  )
  ```
  The `LEAST()` clamp handles months where the previous month has fewer days (e.g., Mar 31 → Feb 28).

**Active customer definition:** "Ordered at least once with `payment_status = 'PAID'` in the current calendar month (UTC)". `active_customers_prev` uses the identical Previous MTD window.

**AOV:** Computed server-side as `revenue_mtd / orders_mtd` (both INTEGER/BIGINT, division yields FLOAT or NUMERIC — round to 2 decimal places). Returns as BIGINT (cents).

#### Customer Endpoints

```
GET /api/v1/customers/?page=1&per_page=20&search=john
```

Paginated response:

```json
{
  "data": [
    {
      "id": "...",
      "email": "john@acme.com",
      "first_name": "John",
      "last_name": "Doe",
      "total_orders": 5,
      "total_spent": 278350,
      "created_at": "2026-01-15T00:00:00Z"
    }
  ],
  "total": 89,
  "page": 1,
  "per_page": 20
}
```

All monetary values in cents (BIGINT).

```
GET /api/v1/customers/{id}
```

Returns full profile + order history:

```json
{
  "id": "...",
  "email": "john@acme.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+44...",
  "is_verified": true,
  "total_orders": 5,
  "total_spent": 278350,
  "average_order_value": 55670,
  "addresses": [
    {
      "line1": "123 High St",
      "city": "London",
      "postal_code": "SW1A 1AA",
      "country": "UK",
      "is_default": true
    }
  ],
  "orders": [
    {
      "id": "...",
      "order_number": "ORD-042",
      "total": 14999,
      "status": "confirmed",
      "created_at": "2026-07-07T14:30:00Z"
    }
  ],
  "created_at": "2026-01-15T00:00:00Z",
  "updated_at": "2026-07-07T14:30:00Z"
}
```

`total_spent` is sum of order totals where `payment_status = 'PAID'` minus `refunded_total` (handled by DB trigger — see migration 0005).  
`average_order_value` = `total_spent // total_orders if total_orders > 0 else 0` (integer division, returned as BIGINT cents). **Guard:** ZeroDivisionError prevented — if `total_orders == 0`, return `0`. This guard applies to all AOV calculations (dashboard endpoint + customer detail).

#### Collections CRUD Endpoints

```
GET    /api/v1/collections/           — list (with product_count, optional include_inactive)
POST   /api/v1/collections/           — create
PUT    /api/v1/collections/{id}       — update
DELETE /api/v1/collections/{id}       — soft delete: sets is_active = false, preserves product links
```

```
GET  /api/v1/collections/{id}/products    — list products in collection (paginated)
POST /api/v1/collections/{id}/products    — add products (batch: { product_ids: [...] })
PUT  /api/v1/collections/{id}/products    — reorder (batch: { items: [{product_id, sort_order}] })
DEL  /api/v1/collections/{id}/products/{product_id}  — remove single product
```

Public endpoint:

```
GET /api/v1/public/collections/{tenant_slug}  — active collections with product previews
```

#### ORM Models

- **`Collection`** model in `src/orm/models/collection.py` — mirrors Category structure
- **`ProductCollection`** model in `src/orm/models/product.py` or dedicated `collection.py` — junction table model
- **`Product.collections`** — `Relationship(back_populates="products")` via junction
- **`Collection.products`** — `Relationship(back_populates="collections")` via junction
- Customer schemas moved from `product.py` to dedicated `customer.py`

#### Schemas

- **`CollectionCreate`**: name, slug, description, hero_image_url, hero_image_alt, sort_order
- **`CollectionUpdate`**: partial of create
- **`CollectionResponse`**: includes `product_count`
- **`ProductCollectionResponse`**: product_id, sort_order
- **`CustomerResponse`**: existing schema, ensure `total_orders` and `total_spent` are populated
- **`CustomerDetailResponse`**: extends response with `addresses[]`, `orders[]`, `average_order_value`
- **`DashboardSummaryResponse`**: typed Pydantic model for aggregator payload
- **`LowStockItem`**, **`RecentOrderItem`**, **`FulfillmentCounts`** — sub-models for dashboard

---

## Task 3: Merchant Workspace UI (Admin)

### 3a. Dashboard Page

**File:** `apps/admin/src/app/(app)/dashboard/page.tsx`

Replaces the existing inline dashboard with:

**Big Four KPI Row:**

- Card per metric using shadcn `Card` from `@repo/ui/components/ui/card`
- Each card shows: label, current value (large text), MTD vs previous MTD delta (percentage + arrow)
- Format: Revenue in `£{(n/100).toFixed(2)}`, Orders as integer, AOV as `£`, Customers as integer
- `font-mono` for all numeric values

**Fulfillment Pipeline:**

- Row of colored counter chips below KPIs
- Unfulfilled (amber), Processing (blue), Shipped (purple), Delivered (green)

**Low Stock Alerts:**

- Compact table: product name, SKU, quantity remaining (red if <= threshold)
- Only shown if items exist

**Recent Orders:**

- Last 5 orders in a minimal table: order number, customer, total (monospaced), time elapsed (relative), status chip
- Status chip uses shadcn `Badge` with color mapping

**Data Fetching:**

- Single `useDashboard()` hook using `@tanstack/react-query`
- Calls `GET /api/v1/admin/dashboard/summary` via `api` client
- Loading: skeleton cards via shadcn `Skeleton`
- Error: `ErrorBanner` component
- Refresh: **manual only** via refresh button in the dashboard header. No auto-polling — the 4 parallel queries hit the DB each time; auto-refresh would be wasteful for a metrics dashboard that changes on human (not sub-second) timescales.

### 3b. Customer Directory Page

**File:** `apps/admin/src/app/(app)/customers/page.tsx`  
**File:** `apps/admin/src/components/customers/customers-table.tsx`

- Uses the existing `DataTable` component (`apps/admin/src/components/ui/data-table.tsx`)
- Columns: Name+Email, Joined Date, Orders count, LTV (monospaced `£`)
- Search bar filtering by name/email
- Pagination via shadcn `Pagination`
- Row click navigates to `/admin/customers/{id}`
- Empty state: centered borderless text "No customers yet"

### 3c. Customer Detail Page

**File:** `apps/admin/src/app/(app)/customers/[id]/page.tsx`  
**File:** `apps/admin/src/components/customers/customer-profile.tsx`

Two-column layout:

**Left Column — Profile Card:**

- Name, email, phone
- Created date, last order date
- Primary shipping address (from `customer_addresses`)
- Summary: Total Lifetime Spend, Average Order Value
- `font-mono` for all financials

**Right Column — Order Ledger:**

- Scrollable list of all orders for this customer
- Each row: Order Number (link), Date, Status (colored chip), Total (monospaced)
- Click navigates to `/admin/orders/[id]`

### 3d. Navigation

- Add sidebar link to `/customers` under Catalog section (above Settings)
- SVG icon: users/person icon

### 3e. API Client + Hooks

Extend `apps/admin/src/lib/api/client.ts`:

- `api.customers.list(params)` → `/customers/?...`
- `api.customers.get(id)` → `/customers/{id}`
- `api.collections.list(params)` → `/collections/?...`
- `api.collections.create(data)`, `update(id, data)`, `delete(id)`
- `api.collections.products(id)` → `/collections/{id}/products`
- `api.collections.addProducts(id, product_ids)`, `removeProduct(id, product_id)`
- `api.dashboard.summary()` → `/admin/dashboard/summary`

New service files:

- `apps/admin/src/features/customers/api/customers-service.ts`
- `apps/admin/src/features/customers/hooks/use-customers.ts`
- `apps/admin/src/features/dashboard/hooks/use-dashboard.ts`
- `apps/admin/src/features/collections/api/collections-service.ts`
- `apps/admin/src/features/collections/hooks/use-collections.ts`

---

## Task 4: Editorial Engine (Storefront + Admin Multi-Select)

### 4a. Storefront Collection Routes

```
/[tenant]/collections                — all active collections (grid of hero cards)
/[tenant]/collections/[slug]         — collection detail (hero + product grid filtered by collection)
```

- `ProductGrid` accepts optional `collectionSlug` param
- `api.ts` adds `fetchCollections` and `collection` query param to `fetchProducts`
- Collection hero card: `hero_image_url` as background, name overlay, `is_active` filter

### 4b. Admin Collection Management Page

```
/admin/collections                   — CRUD table (identical pattern to CategoriesTable)
```

**File:** `apps/admin/src/app/(app)/collections/page.tsx`  
**File:** `apps/admin/src/components/collections/collections-table.tsx`  
**File:** `apps/admin/src/components/collections/collection-modal.tsx`

Modal fields: name, slug, description (textarea), hero image (Cloudinary picker), alt text, sort order, is_active toggle.

### 4c. Product Form — Collection Multi-Select

Add a multi-select combobox to the ProductForm:

- Fetches active collections
- Shows checkboxes or tag-style multi-select
- On submit, sends `collection_ids: string[]`
- Backend batch-updates junction table via `POST /collections/{id}/products`

### 4d. TypeScript Types

Add to `packages/tenant-orm/src/types.ts`:

- `Collection` interface
- `CollectionCreate`, `CollectionUpdate`
- `Customer` interface
- `CustomerDetail` interface
- `DashboardSummary` interface
- `LowStockItem`, `RecentOrderItem`, `FulfillmentCounts`

Add to `packages/tenant-orm/src/schemas/tenant.ts`:

- `CollectionSchema`, `CollectionCreateSchema`, `CollectionUpdateSchema`
- `CustomerSchema`
- `DashboardSummarySchema`

---

## Visual Design Constraints

- No avatar grids — clean typography layouts only
- Financial values in `font-mono font-medium text-foreground`
- Empty states: borderless centered text, no illustrations
- Status chips using shadcn `Badge`:
  - unfulfilled → `bg-amber-100 text-amber-800`
  - processing → `bg-blue-100 text-blue-800`
  - shipped → `bg-purple-100 text-purple-800`
  - delivered → `bg-green-100 text-green-800`
  - cancelled → `bg-red-100 text-red-800`

---

## Implementation Order

```
Task 1: Database Base
  ├── Migration 0005: customers + customer_addresses
  └── Migration 0006: collections + product_collections

Task 2: Backend Cohesion Layer
  ├── Customer CRUD routes + pagination
  ├── Dashboard aggregator endpoint
  ├── Collections CRUD + product management
  ├── Public collections endpoint
  └── Customer schemas (move from product.py)

Task 3: Merchant Workspace UI
  ├── Dashboard page (KPIs + fulfillment + low stock + recent orders)
  ├── Customer directory (/customers)
  ├── Customer detail (/customers/[id])
  ├── API client + hooks
  └── Sidebar navigation

Task 4: Editorial Engine
  ├── Admin collections page (CRUD table + modal)
  ├── Product form collection multi-select
  ├── Storefront collection routes
  └── TypeScript types + Zod schemas
```

---

## Testing

- Backend: pytest for all new endpoints (dashboard, customers, collections)
- Frontend: vitest + react-testing-library for dashboard, customer components
- Minimum: 5 new test files, 20+ new tests
- Coverage threshold: 30% (existing)
