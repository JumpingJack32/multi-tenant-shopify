# Cloudinary Image Lifecycle Sync

**Date:** 2026-07-06
**Status:** Approved Design

## Overview

Wire Cloudinary image delivery into every layer of the multi-tenant platform — database, seed, API, storefront, and admin — replacing placeholder demo URLs with a production-grade image pipeline.

## Section 1: Database Schema & Migration

### Product Model Change

Add price to `Product` model as SQLModel `Decimal` field:

```python
# services/backend-api/src/orm/models/product.py
price: Decimal = Field(max_digits=10, decimal_places=2, default=0.00)
```

Price also remains on `Variant` for SKU-level overrides. `Product.price` is the canonical listing/catalog price.

### ProductImage — Already Correctly Defined

```python
class ProductImage(BaseModel, table=True):
    __tablename__ = "product_images"
    product_id: UUID = Field(foreign_key="products.id", ondelete="CASCADE")
    url: str = Field(max_length=2048)          # stores Cloudinary public_id
    alt_text: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0)
    product: Product = Relationship(back_populates="images")
```

No model changes needed — only the migration to create the table.

### New Migration (`0003`)

- **down_revision**: `"0002"`
- **Tables to CREATE**: `product_images`, `variants`, `inventory`, `locations`
- **Tables to ALTER**: `products` — add columns (`slug`, `weight`, `weight_unit`, `is_active`, `price NUMERIC(10,2)`), conditionally drop legacy `price INTEGER` if present
- **Price migration** (if legacy column exists):
  1. Add `price_numeric` as nullable `NUMERIC(10,2)`
  2. `UPDATE products SET price_numeric = price / 100.0`
  3. Drop old `price` column
  4. Rename `price_numeric` to `price`, set `NOT NULL`
- **Foreign keys**: Simple `product_id → products.id` (not composite). RLS + inherited `tenant_id` provide tenant isolation — the established convention.
- **Numeric type**: `sa.Numeric(precision=10, scale=2)` in Alembic maps to `Decimal = Field(max_digits=10, decimal_places=2)` in SQLModel.
- **Idempotent**: Use `CREATE TABLE IF NOT EXISTS`, conditional column checks.

## Section 2: Seed Script & API Layer

### Seed Script

- Store `public_id` only in `product_images.url` (e.g., `demo/products/rocket-skates-hero`)
- Cloudinary base URL constructed at render time via `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Each product gets 3 images (hero + 2 details) with `sort_order` 0, 1, 2
- Set `Product.price` from the first variant's price

### ProductResponse Schema

```python
class ProductImageResponse(PydanticBaseModel):
    id: UUID
    url: str          # public_id
    alt_text: Optional[str] = None
    sort_order: int

class ProductResponse(PydanticBaseModel):
    ...
    price: Decimal
    images: list[ProductImageResponse] = []
```

### API Route

Eagerly load images:
```python
stmt = select(Product).options(selectinload(Product.images))
```

### Frontend Price Display

Change from `£{(n / 100).toFixed(2)}` to `£{n.toFixed(2)}` — price is now decimal pounds.

## Section 3: Frontend Image Pipeline

### next.config.ts

Add remote pattern:
```typescript
{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" }
```

### StorefrontImage + buildCloudinaryUrl

Both already exist. Wire into `ProductGallery` and `ProductCard`:

- Replace `next/image` with `StorefrontImage` (backed by `CldImage`)
- Supply `public_id` from API response, let `StorefrontImage` resolve the full Cloudinary URL via `buildCloudinaryUrl`
- `format="auto"` for automatic WebP/AVIF
- Transparency note: ghost cards use `bg-black`, so Cloudinary's auto-format must be tested against alpha-channel assets. If artifacts appear, force `format="webp"` with a background fill.

### Data Flow

```
DB (product_images.url = public_id)
  → API (ProductResponse.images[].url = public_id)
  → ProductGallery/ProductCard
  → StorefrontImage (CldImage)
  → buildCloudinaryUrl(public_id, { w, h, f_auto, q_auto })
  → res.cloudinary.com/<cloud_name>/image/upload/f_auto/q_auto/w_800/demo/products/rocket-skates-hero
```

## Section 4: Admin Image Management

### ImageManager Component

New client component rendered inside the product edit page:
- Displays existing images as a sortable grid
- Each card: Cloudinary thumbnail (`w=200`), alt text input, delete button
- "Add Image" opens Cloudinary Upload Widget

### Upload Flow

1. Admin clicks "Add Image" → Cloudinary Upload Widget opens (signed uploads via backend `generate_upload_signature`)
2. Widget returns `public_id`
3. Frontend POST `{ public_id, alt_text, sort_order }` to `/products/{id}/images`
4. Backend creates ProductImage row
5. Grid refreshes

### Backend Image CRUD

| Method | Path | Body | Notes |
|--------|------|------|-------|
| `POST` | `/products/{id}/images` | `{ public_id, alt_text?, sort_order? }` | API field is `public_id`, not `url` |
| `PATCH` | `/product-images/{image_id}` | `{ alt_text?, sort_order? }` | |
| `DELETE` | `/product-images/{image_id}` | — | Also calls `cloudinary.uploader.destroy(public_id)` to remove orphaned CDN assets |

### Safeguards

1. **Form upload state**: Parent form tracks `isUploading` flag. Save/Update button disabled while Cloudinary Widget is active.
2. **Field naming**: API parameter and DB column both explicitly named `public_id` to prevent URL confusion.
3. **CDN cleanup**: DELETE endpoint destroys Cloudinary resource after DB row deletion.

## Key Principles

- **Public ID only** in database — environment-agnostic, multi-tenant safe
- **RLS over composite FKs** — tenant isolation via existing Row-Level Security + inherited `tenant_id`
- **Decimal pounds** — `NUMERIC(10,2)` / Python `Decimal`, no cents conversion
- **YAGNI** — no bulk upload, no alt-text AI, no cropping UI, no CDN invalidation UI
