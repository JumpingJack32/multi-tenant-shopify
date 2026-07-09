# Database Seed Script — Extended Design

## Goal

Replace the minimal `services/backend-api/seed_database.py` with a complete,
idempotent seed that populates every table in the schema with realistic
development data, enabling dashboard visualisation, pagination, and merchant
workflow testing without hand-entering records.

## Strategy

**Truncate + re-seed.** On each run, wipe all tenant data tables in reverse
dependency order, then rebuild from scratch. This eliminates foreign-key
conflicts, stale state, and duplicate rows. The three tenant identities
(acme-corp, globex-inc, initech) are stable — they are the only records
preserved across runs.

## Execution hierarchy

Each layer depends on the one before it:

```
Layer 1 — Core Tenants & Users
  tenants (3), tenant_users (1 admin per tenant)

Layer 2 — Catalog
  categories (5 per tenant), collections (4 per tenant)
  products (5+4+3), variants (1 per product), product_images (3 per product)

Layer 3 — Relationships & Inventory
  product_collections (each product in 1-2 collections)
  locations (2 per tenant)
  inventory (variant × location — 24 rows per tenant)

Layer 4 — Customers & Addresses
  customers (8-10 per tenant)
  customer_addresses (1-2 per customer)

Layer 5 — Orders & History
  orders (15-20 per tenant, spread across 30 days, varied statuses)
  order_items (1-3 items per order)
```

## Detailed table plan

### Tenants (3 — existing, unchanged)

| Slug | Name |
|------|------|
| acme-corp | Acme Corp |
| globex-inc | Globex Inc |
| initech | Initech |

Each gets a single `tenant_users` row: `admin@{slug}.com` with a placeholder
password hash, `role = 'admin'`, and `is_platform_superuser = false`. Platform
superuser status is reserved for global SaaS admins who bypass tenant RLS —
tenant-level admins should be scoped to their own tenant_id.

### Catalog — per tenant

**Categories** (5 per tenant, all tenants share the same set):
Outerwear, Footwear, Accessories, Bottoms, Tops.

**Collections** (4 per tenant):
1. New Arrivals
2. Best Sellers
3. Seasonal
4. Featured

**Products** (varied per tenant to give each a distinct character):

*Acme Corp* — 5 futuristic inventions.
*Globex Inc* — 4 time-travel / sci-fi items.
*Initech* — 3 office parody products.

Each product gets 1 variant (same SKU + "-VAR" suffix) and 3 product images
(hero, detail-1, detail-2) using Cloudinary public-id URLs.

### Relationships

**product_collections**: Every product belongs to 1-2 collections, creating
realistic overlap.

**Locations** (2 per tenant):
1. Main Warehouse
2. Retail Store

**Inventory**: Every variant gets a row for every location (= 12 variants × 2
locations = 24 rows per tenant). Stock levels vary:
- Main Warehouse: 50-200 units
- Retail Store: 5-25 units
- Some items at 0 stock (for testing low-stock alerts)

### Customers & Addresses

8-10 customers per tenant with themed names matching the tenant's character:

- Acme: Looney Tunes characters
- Globex: Sci-fi / Back to the Future characters
- Initech: Office Space characters

Each customer gets 1-2 addresses (shipping + optional billing).

### Orders

15-20 orders per tenant spread over the last 30 days with realistic patterns:

- 60% CONFIRMED / SHIPPED / DELIVERED (completed)
- 20% PENDING (in progress)
- 10% CANCELLED
- 10% REFUNDED

Each order has 1-3 order items drawing from the tenant's products. Timestamps
are randomly distributed across the past 30 days so dashboard line charts show
meaningful trends.

Order totals (subtotal, tax, shipping, total) are computed from item prices
rather than hard-coded.

## Script structure

The script will be refactored into focused async functions:

```
seed_database.py
├── seed_tenants()              — Layer 1
├── seed_users()                — Layer 1 (tenant_users)
├── seed_catalog()              — Layer 2 (categories, collections, products, variants, images)
├── seed_relationships()        — Layer 3 (product_collections, locations, inventory)
├── seed_customers()            — Layer 4 (customers + addresses)
├── seed_orders()               — Layer 5 (orders + items)
└── main()                      — orchestrator, calls above in order
```

Each helper receives the tenant row dicts and a shared asyncpg connection,
returns generated IDs for downstream use.

## Usage

```bash
cd services/backend-api
DATABASE_URL="postgresql+asyncpg://..." python seed_database.py
```

The DATABASE_URL is expected to come from Doppler (existing convention) or a
local Supabase instance. The script strips the `+asyncpg` prefix for asyncpg
compatibility, matching the current script's convention.

## Idempotency

The script always truncates tenant-scoped child tables at the start (via
manual reverse-order DELETE, not `TRUNCATE ... CASCADE`) — targeting
`order_items`, `orders`, `inventory`, `locations`, `product_collections`,
`collections`, `customer_addresses`, `customers`, `product_images`,
`variants`, `products`, `categories`, `tenant_users` in that order. The
`tenants` table itself is never truncated, so the 3 stable identities survive
re-runs. New rows in child tables use their tenant_id FK to link back to
existing tenants.

## Technology choices

- **asyncpg with raw SQL** is used (not SQLModel `AsyncSession`) for speed and
  simplicity. The script returns plain dicts of IDs, not ORM model instances.
  The main orchestrator wraps all layers in a single transaction so a failure
  in Layer 4 or 5 triggers a full rollback — no partial state.

## Constraints & edge cases

- **Inventory coverage**: Every variant must have an inventory row for every
  location — the admin inventory UI expects complete coverage.
- **Order-customer linkage**: Every order must reference a real customer_id.
- **Order timestamps**: Spread across a 30-day window so dashboard
  time-series charts have data.
- **No real PII**: All customer data is fictional.
- **Variant scoping**: Order-item generation must randomly select variants only
  from the order's own tenant's product set — never cross-tenant.
- **Run time**: Should complete in under 5 seconds on a local Supabase
  instance.
