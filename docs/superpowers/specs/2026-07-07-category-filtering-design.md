# Category Filtering — Design Spec

## Overview

Add single-category product filtering to the multi-tenant Shopify storefront. Products belong to exactly one primary category. A secondary collections/tags system is deferred.

## Database — Migration 0004

### `categories` table

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, `gen_random_uuid()` |
| `tenant_id` | UUID | NOT NULL, FK → tenants |
| `name` | TEXT | NOT NULL |
| `slug` | TEXT | NOT NULL |
| `description` | TEXT | nullable |
| `image_url` | TEXT | nullable |
| `sort_order` | INTEGER | default 0 |
| `is_active` | BOOLEAN | default true |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

### Constraints

- `UniqueConstraint("tenant_id", "slug", name="uq_categories_tenant_slug")`
- RLS enabled with policy: `tenant_id = current_setting('app.current_tenant_id')::uuid`
- Index on `(tenant_id, slug)` for filtered lookups

### Product table changes

- Add `category_id` UUID, nullable, FK → `categories(id)` ON DELETE SET NULL
- Index on `(tenant_id, category_id)` for filtered queries

## Backend API

### Public endpoints

- **`GET /api/v1/public/products/{tenant_slug}?category=<slug>`**
  - Optional `category` query param
  - When present: `JOIN Category ON Product.category_id = Category.id WHERE Category.slug == :slug AND Category.is_active == True`
- **`GET /api/v1/public/categories/{tenant_slug}`**
  - Returns active categories for tenant: `{id, name, slug, description, image_url, sort_order}`

### Admin CRUD endpoints

- **`GET /api/v1/categories/`** — tenant-scoped via X-Tenant-ID
- **`POST /api/v1/categories/`** — create
- **`PUT /api/v1/categories/{id}`** — update
- **`DELETE /api/v1/categories/{id}`** — delete (products get `category_id = NULL`)

### Pydantic schemas

- `CategoryCreate`: name, slug, description?, image_url?, sort_order?
- `CategoryUpdate`: all optional
- `CategoryResponse`: id, tenant_id, name, slug, description, image_url, sort_order, is_active, product_count: int

## Storefront Routes

| Route | File | Behavior |
|---|---|---|
| `/[tenant]` | `[tenant]/page.tsx` | Brand landing — unchanged |
| `/[tenant]/shop/all` | `[tenant]/shop/all/page.tsx` | Full catalog — fetch all products |
| `/[tenant]/shop/[category]` | `[tenant]/shop/[category]/page.tsx` | Category PLP — filtered via `?category=slug` |

## Admin Category UI

### Category management page (`/admin/categories`)

- Data table matching existing Orders/Products layout
- Borderless grid (`border-b border-border`, `py-2`)
- Columns: Name, Slug, Status (ACTIVE/INACTIVE), Product Count
- Create/edit modal
- Delete with soft-check confirmation if products assigned

### Product form category dropdown

- Combobox with type-to-filter
- Populated from `GET /api/v1/categories/`
- Nullable

## Testing

1. Category CRUD via admin endpoints
2. Public categories list with tenant isolation
3. Product filtering via `?category=slug`
4. Orphan cleanup: delete category → products keep `category_id = NULL` → visible in `/shop/all`
5. Storefront route rendering
6. Seed data slug determinism

## Seed Data

- 5-6 categories per tenant: Outerwear, Footwear, Accessories, Bottoms, Tops
- Deterministic slug generation (lowercase, spaces→hyphens)
- Existing products assigned to categories
