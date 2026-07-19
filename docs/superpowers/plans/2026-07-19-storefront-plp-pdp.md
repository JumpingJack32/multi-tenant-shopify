# Storefront PLP/PDP — Implementation Plan (Approved)

**Spec:** `docs/superpowers/specs/2026-07-02-storefront-plp-pdp.md`

---

## Step 1 — Backend Data Layer

### 1a — Add `specs` field to Product model

**File:** `services/backend-api/src/orm/models/product.py`

```python
from sqlalchemy import JSON

specs: Optional[list[dict[str, str]]] = Field(
    default=None,
    sa_type=JSON,
    nullable=True,
)
```

### 1b — Add `specs` to Pydantic schemas

- `services/backend-api/src/orm/schemas/product.py` — add to `ProductResponse`, `ProductCreate`, `ProductUpdate`
- `services/backend-api/src/orm/schemas/storefront.py` — add to `StorefrontProductResponse`

### 1c — Update seed data

**File:** `services/backend-api/seed_database.py`
Add sample `specs` arrays to existing products.

### 1d — Generate and run migration

```bash
cd services/backend-api
doppler run -- uv run alembic revision --autogenerate -m "add product specs field"
doppler run -- uv run alembic upgrade head
```

---

## Step 2 — Shared Types & Cart Extensions

### 2a — Update `packages/tenant-orm/src/types.ts`

Add `specs?: { label: string; value: string }[] | null;` to Product interface.

### 2b — Extend `useCart` hook

**File:** `apps/storefront/src/hooks/use-cart.ts`
Extend `CartItem` with `name`, `price`, `image`. Update `addItem` to persist metadata.

---

## Step 3 — Storefront Components

### 3a — ProductCard (rewrite)

Ghost card, cross-fade, skeleton loading.

### 3b — ProductGrid

Server component, tag-based caching, renders ProductCards.

### 3c — ProductGallery

Client component, hero + detail images, video stubbed.

### 3d — ProductInfo

Sticky sidebar, size selector, specs list, risk relievers.

### 3e — AddToCartButton

Integrates with useCart, confirmation state, double-click guard.

---

## Step 4 — Page Routes & Dynamic Scoping

### 4a — Brand landing page

**File:** `apps/storefront/src/app/[tenant]/page.tsx`

### 4b — PLP routes

**Files:**

- `apps/storefront/src/app/[tenant]/shop/all/page.tsx` — New
- `apps/storefront/src/app/[tenant]/shop/[category]/page.tsx` — Rewrite
  Both use `await params`.

### 4c — PDP route

**File:** `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx` — New
`await params`, single product fetch, 404 handling.

### 4d — Update root nav links

**File:** `apps/storefront/src/app/page.tsx`
Use `/${tenant}/shop/all` with dynamic tenant interpolation (not hardcoded `/shop/all`).
