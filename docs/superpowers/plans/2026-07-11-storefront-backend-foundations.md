# Storefront Backend Foundations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the backend infrastructure that unblocks the Next.js storefront — cents standardization, generic pagination, variant CRUD, and aggregated storefront endpoints.

**Architecture:** Standardize all prices to integer cents, drop `Product.price` column, add generic `PaginatedResponse[T]`, create variant CRUD sub-routes under products, add storefront-specific read endpoints under `/api/v1/storefront/{tenant_slug}`.

**Tech Stack:** FastAPI, SQLModel/SQLAlchemy, Pydantic v2, Alembic, PostgreSQL

## Global Constraints

- All prices in integer cents (int, ge=0)
- Pydantic v2 syntax: `int = Field(ge=0)` (not deprecated `conint`)
- Storefront routes use tenant slug in path, not X-Tenant-ID header
- Admin routes keep existing `/api/v1/products` prefix

---

### Task 1: Migration 0010 — cents standardization + drop Product.price

**Files:**

- Create: `alembic/versions/0010_integer_cents_for_variant_price.py`

- [ ] **Step 1: Create migration file**

```python
"""convert variant.price to integer cents, drop product.price

Revision ID: 0010
Revises: 0009
"""
from typing import Sequence, Union
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS price")
    op.execute("""
        ALTER TABLE variants ALTER COLUMN price TYPE INTEGER USING price::integer
    """)
    op.execute("ALTER TABLE variants ALTER COLUMN price SET DEFAULT 0")
    op.execute("ALTER TABLE variants ADD CONSTRAINT variants_price_check CHECK (price >= 0)")

def downgrade() -> None:
    op.execute("ALTER TABLE variants DROP CONSTRAINT IF EXISTS variants_price_check")
    op.execute("ALTER TABLE variants ALTER COLUMN price TYPE DOUBLE PRECISION USING price::double precision")
    op.execute("ALTER TABLE variants ALTER COLUMN price SET DEFAULT 0")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0.00")
```

- [ ] **Step 2: Verify file exists**

Run: `ls alembic/versions/0010_integer_cents_for_variant_price.py`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add alembic/versions/0010_integer_cents_for_variant_price.py
git commit -m "feat(db): migration 0010 — convert variant.price to integer cents, drop product.price"
```

---

### Task 2: ORM model updates

**Files:**

- Modify: `src/orm/models/product.py`

**Interfaces:**

- `Product` model: `price` field removed
- `Variant` model: `price: int = Field(default=0, ge=0)`
- `Variant.cost_price` stays as `Optional[int]` (already cents)

- [ ] **Step 1: Update Product model — remove price field**

```python
class Product(BaseModel, table=True):
    # Remove: price: Decimal = Field(max_digits=10, decimal_places=2, default=0.00)
```

- [ ] **Step 2: Update Variant model — price to int**

```python
class Variant(BaseModel, table=True):
    price: int = Field(default=0, ge=0, description="Price in cents")
```

- [ ] **Step 3: Verify model changes**

---

### Task 3: Schema updates — all prices to int cents

**Files:**

- Modify: `src/orm/schemas/product.py`
- Modify: `src/orm/schemas/inventory.py`

- [ ] **Step 1: Update product schemas**

In `src/orm/schemas/product.py`:

- `ProductResponse`: remove `price` field
- `VariantCreate.price`: `int = Field(..., ge=0)`
- `VariantUpdate.price`: `Optional[int] = Field(None, ge=0)`
- `VariantResponse.price`: `int = Field(ge=0)`
- `VariantResponse.compare_at_price`: `Optional[int] = Field(None, ge=0)`

- [ ] **Step 2: Update inventory schemas**

In `src/orm/schemas/inventory.py`:

- `InventoryVariantResponse.price`: `int = Field(ge=0)`
- `InventoryVariantResponse.cost`: `int = Field(ge=0)`
- `InventoryItemCreateInput.price`: `Optional[int] = Field(None, ge=0)`
- `InventoryItemPatchInput.price`: `Optional[int] = Field(None, ge=0)`
- `InventoryStatsResponse.total_value`: `int`

- [ ] **Step 3: Verify schemas**

---

### Task 4: Route fixes for cents arithmetic

**Files:**

- Modify: `src/routes/products.py`
- Modify: `src/routes/inventory.py`

- [ ] **Step 1: Fix inventory route price arithmetic**

In `src/routes/inventory.py`:

- `InventoryVariantResponse(cost=...)`: change `float(v.price)` to `v.price`
- `total_value` computation: `total_value += (v.price or 0) * v_stock` — stays same (both ints now, result is int)
- `InventoryStatsResponse(total_value=...)`: change `round(total_value, 2)` to `total_value`

- [ ] **Step 2: Fix products route variant creation**

In `src/routes/products.py`:

- Change `price=data.price or 0.0` to `price=data.price or 0`

---

### Task 5: Generic PaginatedResponse[T]

**Files:**

- Create: `src/orm/schemas/common.py`
- Modify: `src/orm/schemas/__init__.py`
- Modify: `src/orm/schemas/inventory.py` (use PaginatedResponse)

- [ ] **Step 1: Create common.py with generic pagination**

```python
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int

class PaginatedResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: PaginationMeta
```

- [ ] **Step 2: Refactor InventoryListResponse to use PaginatedResponse**

```python
# Before:
class InventoryListResponse(BaseModel):
    data: list[InventoryItemResponse]
    pagination: PaginationMeta

# After — remove this, use PaginatedResponse[InventoryItemResponse] in the route
```

- [ ] **Step 3: Export from schemas **init****

---

### Task 6: Variant CRUD endpoints

**Files:**

- Modify: `src/routes/products.py`
- Modify: `src/orm/schemas/product.py` (add VariantResponse re-exports)
- Modify: `src/orm/schemas/__init__.py` (ensure VariantResponse, VariantCreate, VariantUpdate exported)

- [ ] **Step 1: Add variant CRUD routes**

Add to `products.py` (same router, prefix `/api/v1/products`):

```python
@router.get("/{product_id}/variants", response_model=list[VariantResponse])
async def list_variants(...)

@router.post("/{product_id}/variants", response_model=VariantResponse, status_code=201)
async def create_variant(...)

@router.get("/{product_id}/variants/{variant_id}", response_model=VariantResponse)
async def get_variant(...)

@router.put("/{product_id}/variants/{variant_id}", response_model=VariantResponse)
async def update_variant(...)

@router.delete("/{product_id}/variants/{variant_id}", status_code=204)
async def delete_variant(...)
```

All routes verify `product.tenant_id == tenant_id` for tenant isolation.

---

### Task 7: Storefront schemas

**Files:**

- Create: `src/orm/schemas/storefront.py`

- [ ] **Step 1: Create storefront response schemas**

```python
class StorefrontVariantResponse(BaseModel):
    id: UUID
    sku: str
    price: int = Field(ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    is_active: bool
    in_stock: bool
    options: dict

class StorefrontProductResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    status: str
    min_price: int = Field(ge=0)
    max_price: int = Field(ge=0)
    images: list[ProductImageResponse] = []
    variants: list[StorefrontVariantResponse] = []
    category_slug: Optional[str] = None
    collection_slugs: list[str] = []
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Export from schemas **init****

---

### Task 8: Storefront routes

**Files:**

- Create: `src/routes/storefront.py`
- Modify: `src/main.py`

- [ ] **Step 1: Create storefront router**

```python
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

router = APIRouter()

@router.get("/{tenant_slug}/products", response_model=PaginatedResponse[StorefrontProductResponse])
async def list_storefront_products(
    tenant_slug: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    collection: str | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of published products for storefront."""
    # 1. Resolve tenant
    tenant = await _resolve_tenant(db, tenant_slug)
    # 2. Count + fetch products with eager loading
    # 3. Compute min_price/max_price/in_stock in Python
    # 4. Return PaginatedResponse

@router.get("/{tenant_slug}/products/{product_slug}", response_model=StorefrontProductResponse)
async def get_storefront_product(
    tenant_slug: str,
    product_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Single product detail for storefront PDP."""
    # Same aggregation logic, single product
```

- [ ] **Step 2: Register in main.py**

Add: `from src.routes.storefront import router as storefront_router`
Add: `app.include_router(storefront_router, prefix="/api/v1/storefront")`

---

### Task 9: Fix seed database

**Files:**

- Modify: `seed_database.py`

- [ ] **Step 1: Remove Product.price from INSERT**

Change:

```sql
INSERT INTO products (id, tenant_id, name, slug, description, price, status, ...)
```

To:

```sql
INSERT INTO products (id, tenant_id, name, slug, description, status, ...)
```

And remove `"price_cents": price_cents` from the params dict.

---

### Task 10: Fix tests

**Files:**

- Modify: `tests/test_dashboard.py`

- [ ] **Step 1: Update test assertions for int prices**

Dashboard tests create `_order` with `total=2000` (already int). No change needed for existing assertions — verify `resp.json()["revenue_mtd"] == 6000` already passes.

- [ ] **Step 2: Run existing tests**

Run: `uv run pytest tests/test_dashboard.py -v`
Expected: All 10 tests pass

---

### Task 11: Write storefront tests

**Files:**

- Create: `tests/test_storefront.py`

- [ ] **Step 1-5: Test empty tenant returns defaults**
- [ ] **Step 6-10: Test KPI and product aggregation**
- [ ] **Step 11-15: Test variant in_stock flag**
- [ ] **Step 16-20: Test tenant isolation**
