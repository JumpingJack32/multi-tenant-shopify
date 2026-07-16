# Cloudinary Image Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Cloudinary image delivery from database through API to storefront/admin, replacing placeholder demo URLs with a production pipeline.

**Architecture:** Price moves to Product as `NUMERIC(10,2)` (decimal pounds). ProductImages store Cloudinary public IDs (not full URLs). Admin uses Cloudinary Upload Widget for image management. Storefront uses existing `CldImage` wrapper.

**Tech Stack:** Python 3.12, FastAPI/SQLModel, SQLAlchemy 2.0/asyncio, Alembic, Next.js 16, CldImage, Cloudinary Upload Widget, Base UI

## Global Constraints

- Price stored as `Decimal`/`NUMERIC(10,2)` — decimal pounds, not cents
- `ProductImage.url` stores Cloudinary public IDs only, not full URLs
- RLS for tenant isolation (not composite foreign keys)
- Frontend price display: `£{n.toFixed(2)}` (no `/ 100`)
- `StorefrontImage` wraps `CldImage` from `next-cloudinary`
- Admin uses Cloudinary signed uploads via existing `generate_upload_signature`
- DELETE endpoint also calls `cloudinary.uploader.destroy(public_id)`
- Form submit disabled while `isUploading` is true

---

### Task 1: Database Migration (Alembic 0003)

**Files:**

- Create: `services/backend-api/alembic/versions/0003_add_product_images_variants_inventory.py`

**Interfaces:**

- Consumes: Existing `0002_add_platform_superuser` migration
- Produces: Database tables matching current SQLModel definitions (Product, ProductImage, Variant, Inventory, Location)

- [ ] **Step 1: Write the migration**

```python
"""add product_images, variants, inventory, locations; update products

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    # ── product_images ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            url VARCHAR(2048) NOT NULL,
            alt_text VARCHAR(500),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_product_images_product
        ON product_images (product_id)
    """)

    # ── variants ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS variants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            sku VARCHAR(100) NOT NULL,
            barcode VARCHAR(255),
            price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
            compare_at_price NUMERIC(10, 2) CHECK (compare_at_price >= 0),
            weight DOUBLE PRECISION,
            weight_unit VARCHAR(10) NOT NULL DEFAULT 'kg',
            inventory_quantity INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            options JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_variants_tenant_sku
        ON variants (tenant_id, sku)
    """)

    # ── locations ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            city VARCHAR(100),
            country VARCHAR(100),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # ── inventory ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
            location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
            quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
            reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
            reorder_level INTEGER NOT NULL DEFAULT 0,
            reorder_quantity INTEGER NOT NULL DEFAULT 50,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_tenant_variant
        ON inventory (tenant_id, variant_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_tenant_location
        ON inventory (tenant_id, location_id)
    """)

    # ── Update products table ─────────────────────────────────────────────
    # Add columns that don't exist yet (idempotent via IF NOT EXISTS or DO block)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='slug') THEN
                ALTER TABLE products ADD COLUMN slug VARCHAR(255);
                CREATE INDEX IF NOT EXISTS ix_products_slug ON products (slug);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weight') THEN
                ALTER TABLE products ADD COLUMN weight DOUBLE PRECISION;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weight_unit') THEN
                ALTER TABLE products ADD COLUMN weight_unit VARCHAR(10) NOT NULL DEFAULT 'kg';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
                ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
                -- Check if old integer price column exists
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price' AND data_type='integer') THEN
                    ALTER TABLE products ADD COLUMN price_numeric NUMERIC(10, 2);
                    UPDATE products SET price_numeric = price::NUMERIC / 100.0;
                    ALTER TABLE products DROP COLUMN price;
                    ALTER TABLE products RENAME COLUMN price_numeric TO price;
                    ALTER TABLE products ALTER COLUMN price SET NOT NULL;
                    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
                ELSE
                    ALTER TABLE products ADD COLUMN price NUMERIC(10, 2) NOT NULL DEFAULT 0;
                    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
                END IF;
            END IF;
        END $$;
    """)

    # Add composite index for tenant+slug lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_tenant_slug
        ON products (tenant_id, slug)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS inventory")
    op.execute("DROP TABLE IF EXISTS locations")
    op.execute("DROP TABLE IF EXISTS variants")
    op.execute("DROP TABLE IF EXISTS product_images")
    # Note: products table alterations are NOT reverted in downgrade
    # to avoid data loss. Full rollback requires a restore.
```

- [ ] **Step 2: Run the migration**

```bash
cd services/backend-api
alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 0002 -> 0003`

- [ ] **Step 3: Verify tables exist**

```bash
psql "$DATABASE_URL" -c "\dt product_images variants inventory locations"
```

Expected: All four tables listed.

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/alembic/versions/0003_add_product_images_variants_inventory.py
git commit -m "feat(db): add product_images, variants, inventory, locations migration (0003)"
```

---

### Task 2: Product Model + Pydantic Schemas + API Routes

**Files:**

- Modify: `services/backend-api/src/orm/models/product.py` (add price to Product)
- Modify: `services/backend-api/src/orm/schemas/product.py` (add ProductImageResponse, update ProductResponse)
- Modify: `services/backend-api/src/routes/products.py` (eager-load images)
- Modify: `services/backend-api/src/routes/public.py` (eager-load images)

**Interfaces:**

- Consumes: Task 1 (migration creates tables)
- Produces: API returns `ProductResponse` with `price: Decimal` and `images: list[ProductImageResponse]`

- [ ] **Step 1: Add `price` field to Product model**

Edit `services/backend-api/src/orm/models/product.py` line 31:

```python
from decimal import Decimal
# Add before is_active:
price: Decimal = Field(max_digits=10, decimal_places=2, default=0.00)
```

- [ ] **Step 2: Add ProductImageResponse and update ProductResponse**

Edit `services/backend-api/src/orm/schemas/product.py`:

```python
# Add after ProductImageCreate (line 93):
class ProductImageResponse(PydanticBaseModel):
    id: UUID
    url: str
    alt_text: Optional[str] = None
    sort_order: int


# Update ProductResponse (line 35) — add price and images:
class ProductResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal = Decimal("0.00")  # NEW
    status: str
    sku: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str
    is_active: bool
    images: list[ProductImageResponse] = []  # NEW
    created_at: datetime
    updated_at: datetime
```

Add import at top:

```python
from decimal import Decimal
```

- [ ] **Step 3: Update product routes to eager-load images**

Edit `services/backend-api/src/routes/products.py`:

Add import at top:

```python
from sqlmodel import select, selectinload
```

Update `list_products` (line 14):

```python
@router.get("/", response_model=list[ProductResponse])
async def list_products(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.tenant_id == tenant_id, Product.is_active == True)  # noqa: E712
    )
    result = await db.exec(stmt)
    products = result.all()
    return products
```

Update `get_product` (line 38):

```python
@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product
```

Update `update_product` (line 53) — same selectinload pattern for get + refresh.

- [ ] **Step 4: Update public routes**

Edit `services/backend-api/src/routes/public.py`:

Add import:

```python
from sqlmodel import select, selectinload
```

Update `public_products` (line 38):

```python
stmt = (
    select(Product)
    .options(selectinload(Product.images))
    .where(
        Product.tenant_id == tenant.tenant_id,
        Product.is_active == True,  # noqa: E712
    )
)
```

- [ ] **Step 5: Run backend tests**

```bash
cd services/backend-api
pip install -e ".[dev]" && python -m pytest
```

Expected: All existing tests pass with updated response schema.

- [ ] **Step 6: Commit**

```bash
git add services/backend-api/src/orm/models/product.py \
       services/backend-api/src/orm/schemas/product.py \
       services/backend-api/src/routes/products.py \
       services/backend-api/src/routes/public.py
git commit -m "feat(api): add price + images to ProductResponse, eager-load images"
```

---

### Task 3: Seed Script Update

**Files:**

- Modify: `services/backend-api/seed_database.py`

**Interfaces:**

- Consumes: Task 2 (ProductResponse shape)
- Produces: Seeded product_images rows + product prices in database

- [ ] **Step 1: Add product_images insertion and price update to seed**

Edit `seed_database.py`. After each product variant is inserted (the `products_t1.append((pid, vid))` line), add:

```python
# Insert product_images with Cloudinary public IDs
cloudinary_prefix = "demo/products"
image_names = ["hero", "detail-1", "detail-2"]
for sort_order, suffix in enumerate(image_names):
    iid = uuid.uuid4()
    public_id = f"{cloudinary_prefix}/{name.lower().replace(' ', '-')}-{suffix}"
    await conn.execute(
        """INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT DO NOTHING""",
        iid, acme["tenant_id"], pid, public_id, f"{name} - {suffix.replace('-', ' ').title()}", sort_order,
    )

# Set product price from variant price
await conn.execute(
    "UPDATE products SET price = $1 WHERE id = $2 AND price IS NULL",
    price, pid,
)
```

Repeat this block for globex-inc and initech product creation loops.

- [ ] **Step 2: Run the seed**

```bash
cd services/backend-api
python seed_database.py
```

Expected: "Database seeded successfully!" with product_images counts reflected.

- [ ] **Step 3: Verify seeded data**

```bash
psql "$DATABASE_URL" -c "SELECT p.name, pi.url, pi.sort_order FROM products p JOIN product_images pi ON pi.product_id = p.id ORDER BY p.name, pi.sort_order;"
```

Expected: Each product has 3 image rows with public_id paths.

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add product_images with Cloudinary public IDs and product prices"
```

---

### Task 4: Frontend Image Pipeline + Price Display

**Files:**

- Modify: `apps/storefront/next.config.ts` (add Cloudinary remote pattern)
- Modify: `apps/storefront/src/components/storefront/product-gallery.tsx` (replace `next/image` with `StorefrontImage`)
- Modify: `apps/storefront/src/components/storefront/product-card.tsx` (replace `next/image` + fix price display)
- Maybe modify: PDP page or `ProductInfo` component for price display

**Interfaces:**

- Consumes: Task 2 (API returns `ProductResponse.images[].url` as public_id + `price` as Decimal)
- Produces: Storefront renders Cloudinary-optimized images + correct decimal prices

- [ ] **Step 1: Update next.config.ts**

Add Cloudinary to `remotePatterns`:

```typescript
remotePatterns: [
  { protocol: "https", hostname: "www.craiyon.com" },
  { protocol: "https", hostname: "www.unsplash.com", port: "" },
  { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
],
```

- [ ] **Step 2: Refactor ProductGallery to use StorefrontImage**

Replace `import Image from "next/image"` with `import { StorefrontImage } from "@/components/storefront/storefront-image"`.

Replace all `<Image>` usage in the gallery:

```tsx
<StorefrontImage
  src={hoveredIndex === 0 && images.length > 1 ? images[1] : heroImage}
  alt={name}
  variant="pdpHero"
  className="object-cover"
/>
```

For detail images (the second block), use `variant="pdpDetail"`:

```tsx
<StorefrontImage
  src={
    hoveredIndex === actualIndex && nextIndex < images.length
      ? images[nextIndex]
      : img
  }
  alt={name}
  variant="pdpDetail"
  className="object-cover"
/>
```

Remove the `fill` prop and `sizes` prop — `StorefrontImage` handles dimensions via `variantDefaults`.

- [ ] **Step 3: Refactor ProductCard to use StorefrontImage**

Replace `import Image from "next/image"` with `import { StorefrontImage } from "@/components/storefront/storefront-image"`.

Replace `<Image>` usage:

```tsx
<StorefrontImage
  src={isHovered && secondaryImage != null ? secondaryImage : primaryImage}
  alt={product.name}
  variant="plp"
  className="object-cover"
/>
```

- [ ] **Step 4: Fix price display to decimal pounds**

In `ProductCard`, change:

```tsx
£{product.price != null && `£${(product.price / 100).toFixed(2)}`}
```

to:

```tsx
{
  product.price != null && `£${product.price.toFixed(2)}`;
}
```

Search for other `/ 100` price patterns:

```bash
rg 'price\s*/\s*100' apps/storefront/src/
```

Fix any matching occurrences by removing the `/ 100`.

- [ ] **Step 5: Run storefront tests**

```bash
cd apps/storefront
pnpm vitest run --no-coverage
```

Expected: All tests pass. If ProductGallery tests use `/ 100` assertions, update them.

- [ ] **Step 6: Verify dev server**

```bash
cd apps/storefront
pnpm dev
```

Visit `http://localhost:3000` → navigate to a product → verify images load from Cloudinary and prices show as `£299.99` (not divided by 100).

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/next.config.ts \
       apps/storefront/src/components/storefront/product-gallery.tsx \
       apps/storefront/src/components/storefront/product-card.tsx
git commit -m "feat(storefront): wire Cloudinary images and decimal price display"
```

---

### Task 5: Admin Image CRUD Endpoints

**Files:**

- Modify: `services/backend-api/src/orm/schemas/product.py` (add `ProductImageUpdate`)
- Create: `services/backend-api/src/routes/product_images.py`
- Modify: `services/backend-api/src/routes/__init__.py` or main app file (register router)

**Interfaces:**

- Consumes: Task 2 (ProductImageResponse schema, ProductImage model)
- Produces: `POST /products/{id}/images`, `PATCH /product-images/{id}`, `DELETE /product-images/{id}`

- [ ] **Step 1: Add ProductImageUpdate schema**

In `services/backend-api/src/orm/schemas/product.py`, add after `ProductImageCreate`:

```python
class ProductImageUpdate(PydanticBaseModel):
    alt_text: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None
```

- [ ] **Step 2: Create image CRUD routes**

Create `services/backend-api/src/routes/product_images.py`:

```python
from uuid import UUID

import asyncio

import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

import src.core.cloudinary  # noqa: F401 — ensures Cloudinary is configured
from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Product, ProductImage
from src.orm.schemas.product import ProductImageCreate, ProductImageResponse, ProductImageUpdate

router = APIRouter()


@router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
async def create_product_image(
    product_id: UUID,
    data: ProductImageCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify product exists and belongs to tenant
    stmt = select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    image = ProductImage(
        product_id=product_id,
        tenant_id=tenant_id,
        url=data.url,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
    )
    db.add(image)
    await db.flush()
    await db.refresh(image)
    return image


@router.patch("/product-images/{image_id}", response_model=ProductImageResponse)
async def update_product_image(
    image_id: UUID,
    data: ProductImageUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductImage).where(ProductImage.id == image_id, ProductImage.tenant_id == tenant_id)
    result = await db.exec(stmt)
    image = result.one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(image, key, value)
    await db.flush()
    await db.refresh(image)
    return image


@router.delete("/product-images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    image_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductImage).where(ProductImage.id == image_id, ProductImage.tenant_id == tenant_id)
    result = await db.exec(stmt)
    image = result.one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    # Destroy the Cloudinary asset (run in thread pool to avoid blocking)
    public_id = image.url
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
    except Exception:
        pass  # Log and continue — DB cleanup is the priority

    await db.delete(image)
    await db.flush()
```

- [ ] **Step 3: Register the router**

Edit the FastAPI app bootstrap file (likely `services/backend-api/src/main.py` or similar):

```python
from src.routes.product_images import router as product_images_router
app.include_router(product_images_router, prefix="/api/v1")
```

- [ ] **Step 4: Run backend tests**

```bash
cd services/backend-api
python -m pytest
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/orm/schemas/product.py \
       services/backend-api/src/routes/product_images.py
git commit -m "feat(api): add product image CRUD endpoints with Cloudinary cleanup"
```

---

### Task 6: Admin Image Manager Component

**Files:**

- Create: `apps/admin/src/components/products/image-manager.tsx`
- Modify: `apps/admin/src/app/(app)/products/[id]/page.tsx` or equivalent product edit page
- Additional imports may be needed in the admin's API layer

**Interfaces:**

- Consumes: Task 5 (backend CRUD endpoints at `/api/v1/products/{id}/images`, `PATCH /api/v1/product-images/{id}`, `DELETE /api/v1/product-images/{id}`)
- Produces: Image management grid in admin product form

- [ ] **Step 1: Find the admin product edit page**

```bash
ls apps/admin/src/app/\(app\)/products/
```

Look for a `[id]/page.tsx` or similar edit page. If none exists, the product list page likely opens a drawer/modal instead.

- [ ] **Step 2: Create ImageManager component**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
// Using Base UI for interactive primitives

interface ManagedImage {
  id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
}

interface ImageManagerProps {
  productId: string;
  images: ManagedImage[];
  onImagesChange: (images: ManagedImage[]) => void;
}

export function ImageManager({
  productId,
  images,
  onImagesChange,
}: ImageManagerProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadSuccess = async (result: any) => {
    setIsUploading(true);
    try {
      const publicId = result?.info?.public_id;
      if (!publicId) return;

      const res = await fetch(`/api/v1/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: publicId,
          alt_text: "",
          sort_order: images.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to save image");
      const newImage = await res.json();
      onImagesChange([...images, newImage]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    const res = await fetch(`/api/v1/product-images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete image");
    onImagesChange(images.filter((img) => img.id !== imageId));
  };

  const handleAltTextChange = async (imageId: string, altText: string) => {
    const res = await fetch(`/api/v1/product-images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt_text: altText }),
    });
    if (!res.ok) throw new Error("Failed to update alt text");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {images
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((image) => (
            <div
              key={image.id}
              className="group relative aspect-[4/5] overflow-hidden bg-black"
            >
              <Image
                src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_400,q_auto,f_auto/${image.url}`}
                alt={image.alt_text ?? ""}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <input
                  type="text"
                  defaultValue={image.alt_text ?? ""}
                  placeholder="Alt text"
                  onBlur={(e) => handleAltTextChange(image.id, e.target.value)}
                  className="w-full rounded bg-white/90 px-2 py-1 text-xs text-black"
                />
                <button
                  onClick={() => handleDelete(image.id)}
                  className="ml-1 rounded bg-red-600 px-2 py-1 text-xs text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
      <CldUploadWidget
        uploadPreset="ml_default"
        signatureEndpoint="/api/v1/cloudinary/signature"
        onSuccess={handleUploadSuccess}
      >
        {({ open }) => (
          <button
            type="button"
            disabled={isUploading}
            onClick={() => open()}
            className="rounded border border-dashed px-4 py-2 text-sm disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Add Image"}
          </button>
        )}
      </CldUploadWidget>
    </div>
  );
}
```

- [ ] **Step 3: Wire ImageManager into the product edit page**

Find the admin product edit page and render `<ImageManager>` with the product's images array and an `onImagesChange` callback that updates the parent state.

- [ ] **Step 4: Run admin build/lint**

```bash
cd apps/admin
pnpm lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/products/image-manager.tsx
git commit -m "feat(admin): add ImageManager component with Cloudinary upload widget"
```

---

### Task 7: Cloudinary Signature Endpoint (Admin Upload)

**Files:**

- Create: `services/backend-api/src/routes/cloudinary.py`
- Modify: main app router registration

**Interfaces:**

- Consumes: Task 5 (`cloudinary.uploader.destroy` — uses same `cloudinary` module)
- Produces: `GET /api/v1/cloudinary/signature` endpoint for signed widget uploads

- [ ] **Step 1: Create the signature endpoint**

```python
from fastapi import APIRouter
from src.core.cloudinary import generate_upload_signature

router = APIRouter()


@router.get("/cloudinary/signature")
async def get_upload_signature():
    return generate_upload_signature()
```

- [ ] **Step 2: Register the router**

In main app:

```python
from src.routes.cloudinary import router as cloudinary_router
app.include_router(cloudinary_router, prefix="/api/v1")
```

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/routes/cloudinary.py
git commit -m "feat(api): add Cloudinary upload signature endpoint for admin widget"
```
