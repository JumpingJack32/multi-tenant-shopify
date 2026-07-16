# Storefront Backend Foundations

## Scope

Build the backend infrastructure that unblocks the Next.js storefront: price standardization (integer cents everywhere), generic pagination, variant CRUD under products, and aggregated read-optimized storefront endpoints.

## 1. Integer Cents Standardization

### Problem

Prices are stored in three types across models — `Product.price` (Decimal), `Variant.price` (float), `OrderResponse` schemas (float despite DB being int). This causes serialization issues, JavaScript float math errors, and contract inconsistency.

### Solution

Standardize every price/cost/total field to `int` (cents, `ge=0`):

| Model          | Field                                  | Old Type        | New Type                    |
| -------------- | -------------------------------------- | --------------- | --------------------------- |
| `Product`      | `price`                                | `Decimal`       | **Dropped** (field removed) |
| `Variant`      | `price`                                | `float`         | `int`                       |
| `Variant`      | `cost_price`                           | `Optional[int]` | (already int, no change)    |
| `ProductImage` | (none)                                 | —               | —                           |
| `Order`        | `subtotal/tax/shipping/discount/total` | `int`           | (already int, no change)    |
| `OrderItem`    | `unit_price/total_price/discount`      | `int`           | (already int, no change)    |
| `Customer`     | `total_spent/refunded_total`           | `int`           | (already int, no change)    |

**Response schemas** — all price fields change to `int = Field(ge=0)` (Pydantic v2 style, matching existing codebase convention):

- `ProductResponse.price` → dropped (field removed)
- `VariantResponse.price` → `int = Field(ge=0)`
- `VariantCreate.price` → `int = Field(ge=0)`
- `VariantUpdate.price` → `Optional[int] = Field(None, ge=0)`
- `InventoryVariantResponse.price` → `int = Field(ge=0)`
- `InventoryItemPatchInput.price` → `Optional[int] = Field(None, ge=0)`
- `InventoryItemCreateInput.price` → `Optional[int] = Field(None, ge=0)`
- `InventoryStatsResponse.total_value` → `int`
- `OrderResponse.subtotal/tax/shipping/discount/total` → `int = Field(ge=0)` (fix float serialization bug)
- `OrderItemResponse.unit_price/total_price/discount` → `int = Field(ge=0)`

### Product-level Pricing

Remove `products.price` column entirely. Price lives on variants only. Storefront responses compute `min_price` / `max_price` from active variants. This avoids the state mismatch where a product price drifts from its variants.

### Migration 0010

```sql
-- Drop product.price column
ALTER TABLE products DROP COLUMN IF EXISTS price;

-- Convert variant.price from FLOAT to INTEGER (existing data is already in cents)
ALTER TABLE variants ALTER COLUMN price TYPE INTEGER USING price::integer;
ALTER TABLE variants ALTER COLUMN price SET DEFAULT 0;
ALTER TABLE variants ADD CONSTRAINT variants_price_check CHECK (price >= 0);
```

Existing seed data stores prices as cent values (e.g., 29999 for $299.99). Cast to integer preserves the value directly.

## 2. Generic PaginatedResponse[T]

### Problem

Every paginated endpoint defines its own wrapper type (`InventoryListResponse`). This duplicates code and prevents OpenAPI from generating a shared TypeScript pagination type.

### Solution

Add to `src/orm/schemas/__init__.py` or a new `src/orm/schemas/common.py`:

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

Then refactor `InventoryListResponse` to use `PaginatedResponse[InventoryItemResponse]`.

## 3. Variant CRUD Under Products

### Problem

No dedicated variant management endpoints exist. The only way to create/update variants is through the inventory module, which mixes product and variant concerns.

### Solution

Add CRUD endpoints under `products.py`:

| Method   | Path                                           | Description                 |
| -------- | ---------------------------------------------- | --------------------------- |
| `GET`    | `/products/{product_id}/variants`              | List variants for a product |
| `POST`   | `/products/{product_id}/variants`              | Create variant              |
| `GET`    | `/products/{product_id}/variants/{variant_id}` | Get single variant          |
| `PUT`    | `/products/{product_id}/variants/{variant_id}` | Update variant              |
| `DELETE` | `/products/{product_id}/variants/{variant_id}` | Delete variant              |

All require `X-Tenant-ID` header (admin-only). Tenant-scoped to the product's tenant.

## 4. Storefront Aggregated Endpoints

### Problem

Public products endpoint returns flat `ProductResponse[]` with no variants, stock, or pagination. PDP fetches all products and filters client-side — O(n) per page load.

### Solution

New route file `src/routes/storefront.py` under prefix `/api/v1/storefront`. Tenant identifier must be in the URL path (no `X-Tenant-ID` header). Routes follow the existing public endpoint convention: `/api/v1/storefront/{tenant_slug}/...`.

#### Schema: `StorefrontVariantResponse`

```python
from pydantic import BaseModel, Field

class StorefrontVariantResponse(BaseModel):
    id: UUID
    sku: str
    price: int = Field(ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    is_active: bool
    in_stock: bool  # computed: variant.inventory_quantity > 0
    options: dict  # e.g. {"Size": "M", "Color": "Red"}
```

#### Schema: `StorefrontProductResponse`

```python
class StorefrontProductResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    status: str
    min_price: int = Field(ge=0)    # computed from active variants
    max_price: int = Field(ge=0)    # computed from active variants
    images: list[ProductImageResponse] = []
    variants: list[StorefrontVariantResponse] = []
    category_slug: Optional[str] = None
    collection_slugs: list[str] = []
    created_at: datetime
    updated_at: datetime
```

#### Endpoints

| Method | Path                                                | Description                                        |
| ------ | --------------------------------------------------- | -------------------------------------------------- |
| `GET`  | `/storefront/{tenant_slug}/products`                | Paginated list of published products with variants |
| `GET`  | `/storefront/{tenant_slug}/products/{product_slug}` | Single product detail by slug (full aggregation)   |

#### Avoiding N+1 with `selectinload`

Computed fields (`min_price`, `max_price`, `in_stock`) are derived in Python from eager-loaded relationships, not via raw SQL aggregation. This avoids N+1 queries while keeping the code readable:

```python
from sqlalchemy.orm import selectinload

# 1. Fetch products + variants in exactly 2 SQL queries
stmt = (
    select(Product)
    .options(
        selectinload(Product.variants),
        selectinload(Product.images),
        selectinload(Product.category),
        selectinload(Product.collections),
    )
    .where(Product.tenant_id == tenant_id, Product.status == "published")
)
products = (await db.exec(stmt)).all()

# 2. Compute aggregated fields in Python
results = []
for p in products:
    active_variants = [v for v in p.variants if v.is_active]
    prices = [v.price for v in active_variants]
    min_p = min(prices, default=0)
    max_p = max(prices, default=0)

    results.append(StorefrontProductResponse(
        id=p.id, slug=p.slug, name=p.name,
        description=p.description, status=p.status,
        min_price=min_p, max_price=max_p,
        variants=[StorefrontVariantResponse(
            id=v.id, sku=v.sku, price=v.price,
            compare_at_price=v.compare_at_price,
            is_active=v.is_active,
            in_stock=v.inventory_quantity > 0,
            options=v.options,
        ) for v in active_variants],
        ...
    ))
```

**`GET /storefront/{tenant_slug}/products`**:

- Query params: `page`, `page_size`, `category` (slug), `collection` (slug), `q` (search name)
- Returns `PaginatedResponse[StorefrontProductResponse]`
- Filters: `Product.status == "published"`, `Product.is_active == true`
- Orders by `Product.created_at DESC`
- Tenant resolved by looking up `Tenant` by slug first

**`GET /storefront/{tenant_slug}/products/{product_slug}`**:

- Returns single `StorefrontProductResponse` or 404
- Same aggregation logic as list but for one product

## Implementation Order

1. Migration 0010 — cents standardization + drop Product.price
2. ORM model updates (Variant.price int, Product.price removed)
3. Schema updates (all prices to conint)
4. Route fixes (products.py, inventory.py price arithmetic)
5. Generic PaginatedResponse[T]
6. Variant CRUD endpoints under products
7. Storefront schemas + endpoints
8. Seed database update (remove Product.price ref)
9. Verify: existing tests pass, lint clean, typecheck clean

## Test Strategy

- Existing `test_dashboard.py` — update price types if needed
- Add `test_variants.py` — CRUD operations for variant endpoints
- Add `test_storefront.py` — storefront product list/detail with aggregation
- Use same fixture pattern as `test_dashboard.py` (AsyncClient, ASGITransport, inline DB setup)
