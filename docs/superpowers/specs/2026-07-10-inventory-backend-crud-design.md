# Inventory Backend CRUD — Design Spec

**Date:** 2026-07-10
**Branch:** `feat/inventory-backend`
**PR:** TBD

## Problem

The admin inventory page at `/products/inventory` has a fully-wired frontend (list, stats, create, update, delete dialogs) but hits placeholder API responses — the backend `/api/v1/inventory` routes don't exist yet.

## Design Overview

Build a FastAPI CRUD layer that maps the frontend's flat inventory concept to the relational DB schema (`Product` → `Variant` → `Inventory`). Six endpoints, tenant-isolated, with aggregated read queries and transactional multi-table writes.

---

## 1. Endpoint Contract

| Method | Path | Purpose | Returns |
|--------|------|---------|---------|
| `GET` | `/api/v1/inventory` | Paginated list with search & filters | `InventoryListResponse` |
| `GET` | `/api/v1/inventory/stats` | Aggregate KPIs | `InventoryStatsResponse` |
| `GET` | `/api/v1/inventory/{id}` | Single item with full variant detail | `InventoryItemResponse` |
| `POST` | `/api/v1/inventory` | Create product + variant + inventory | `InventoryItemResponse` (201) |
| `PATCH` | `/api/v1/inventory/{id}` | Partial update (product + variant fields) | `InventoryItemResponse` |
| `DELETE` | `/api/v1/inventory/{id}` | Remove product (cascades via DB FK) | 204 |

All routes use `Depends(get_current_tenant_id)` and `Depends(get_db)`. Router registered at prefix `/api/v1`.

---

## 2. Pydantic Schemas

### Response Schemas (mirror frontend TS types exactly)

```python
class InventoryVariantResponse(BaseModel):
    id: UUID
    item_id: UUID                    # aliased from product_id
    name: str
    sku: str
    barcode: Optional[str] = None
    price: float
    cost: float = 0
    stock: int                       # aggregated inventory_quantity
    reorder_point: int = 0           # from Inventory.reorder_level
    warehouse: str = "Default"       # from Location.name
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventoryItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sku: str                         # first variant's sku
    name: str
    description: Optional[str] = None
    category: Optional[str] = None   # category name, not ID
    image_url: Optional[str] = None  # first product image URL
    status: str                      # computed: in_stock / low_stock / out_of_stock
    supplier: Optional[str] = None
    total_stock: int
    total_value: float
    variants: list[InventoryVariantResponse]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InventoryStatsResponse(BaseModel):
    total_skus: int
    total_value: float
    low_stock_count: int
    out_of_stock_count: int
    total_variants: int

class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int

class InventoryListResponse(BaseModel):
    data: list[InventoryItemResponse]
    pagination: PaginationMeta
```

### Input Schemas (flat — matches dialog payload)

```python
class InventoryItemCreateInput(BaseModel):
    name: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    category: Optional[str] = None
    supplier: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(0, ge=0)

class InventoryItemPatchInput(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    stock: Optional[int] = Field(None, ge=0)
```

---

## 3. Route Implementation

### File: `src/routes/inventory.py`

New route file following the existing pattern (direct ORM in route handlers, no service layer).

#### `GET /inventory` — List with aggregation

Single SQL query using JOIN + GROUP BY:

```python
stmt = (
    select(
        Product,
        func.sum(Inventory.quantity).label("total_stock"),
        func.sum(Variant.price * func.coalesce(Inventory.quantity, 0)).label("total_value"),
    )
    .outerjoin(Variant, Variant.product_id == Product.id)
    .outerjoin(Inventory, Inventory.variant_id == Variant.id)
    .where(Product.tenant_id == tenant_id)
    .group_by(Product.id)
    .offset((page - 1) * page_size)
    .limit(page_size)
)
```

- Search filter: `.where(Product.name.ilike(f"%{q}%"))` when `q` provided
- Category filter: `.where(Product.category.ilike(f"%{category}%"))` when `category` provided
- Status filter: computed in Python after fetch (based on total_stock threshold)
- Separate `COUNT(*)` query for pagination total

#### `GET /inventory/stats` — KPIs

```python
# Total SKUs (variants), total value, low/out-of-stock counts
# Single aggregate query per tenant
```

#### `GET /inventory/{id}` — Single item

```python
# 1. Fetch Product with tenant guard
stmt = select(Product).where(Product.id == id, Product.tenant_id == tenant_id)
# 2. Fetch Variants + Inventory + Locations for this product
# 3. Assemble nested response in Python
```

#### `POST /inventory` — Create (transactional)

Inside session transaction:
1. Create `Product` row with `name`, `description`, `category`, `supplier`, `tenant_id`
2. Create `Variant` row with `product_id`, `sku`, `price`, `inventory_quantity = stock`
3. Create `Inventory` row per location (default to first active tenant location)
4. `commit()` → return assembled `InventoryItemResponse`

#### `PATCH /inventory/{id}` — Update (read-before-write)

1. Fetch existing Product with `.where(Product.tenant_id == tenant_id)` guard
2. Apply product-level field updates (`name`, `category`, `supplier`)
3. Fetch first/primary Variant; apply `sku`, `price` updates
4. Update `Inventory.quantity` if `stock` provided
5. `commit()` → refresh and return

#### `DELETE /inventory/{id}`

```python
product = await db.get(Product, id)
if not product or product.tenant_id != tenant_id:
    raise HTTPException(404)
await db.delete(product)  # cascades via DB FK
await db.commit()         # not flush — close the transaction
```

### Router Registration in `main.py`

```python
from src.routes.inventory import router as inventory_router
app.include_router(inventory_router, prefix="/api/v1")
```

---

## 4. DB Schema Changes

Add `supplier` column to `Product` model in `src/orm/models/product.py`:

```python
supplier: Optional[str] = Field(default=None, max_length=255)
```

(This is a new column — not yet in the DB. Will need an Alembic migration or manual `ALTER TABLE`.)

---

## 5. Testing Strategy

### File: `tests/test_inventory.py`

**Pattern:** Async `httpx.AsyncClient` with `ASGITransport`. Autouse fixture for table creation + cleanup.

### Test Matrix (16 tests)

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_list_empty` | Empty tenant → `{ data: [], pagination: { total: 0 } }` |
| 2 | `test_create_minimal` | Flat `{ name, sku }` → 201 + full `InventoryItemResponse` |
| 3 | `test_create_with_all_fields` | Includes category, supplier, price, stock → mapped correctly |
| 4 | `test_create_duplicate_sku` | 409 on same-tenant SKU collision |
| 5 | `test_get_single` | Create → GET returns matching item with nested variants |
| 6 | `test_get_404` | Random UUID → 404 |
| 7 | `test_list_pagination` | 25 items → page 2 returns items 11-20 |
| 8 | `test_list_search` | Search by name substring |
| 9 | `test_patch_name_and_sku` | PATCH updates product name + variant sku |
| 10 | `test_patch_partial` | PATCH with only category → other fields unchanged |
| 11 | `test_delete` | DELETE → 204, subsequent GET → 404 |
| 12 | `test_tenant_isolation_list` | Tenant A list → Tenant B sees empty |
| 13 | `test_tenant_isolation_get` | Tenant A get → Tenant B gets 404 |
| 14 | `test_tenant_isolation_delete` | Tenant A delete → Tenant B gets 404, A still owns record |
| 15 | `test_stats` | Known values → validates all 5 stat fields |
| 16 | `test_create_transactional_rollback` | Failed insert → no orphan Product |

---

## 6. Status Computation

Derived field, not stored in DB:

| Condition | Status |
|-----------|--------|
| `total_stock == 0` | `"out_of_stock"` |
| `total_stock <= reorder_level` | `"low_stock"` |
| `total_stock > reorder_level` | `"in_stock"` |
| Product `is_active == false` | `"discontinued"` |

Threshold (`reorder_level`) pulled from the primary variant's first `Inventory.reorder_level` record, defaulting to 5.

---

## Open Questions

- `supplier` column migration: Alembic migration or manual `ALTER TABLE`? (Current migration pipeline status unknown.)
- Default location for new inventory records: query first active `Location` per tenant, or create a synthetic "Default Warehouse" on the fly?
- SKU uniqueness: scoped per-tenant or globally? (Recommend: per-tenant `WHERE tenant_id = :tid`.)
- The `category` field on the frontend is a free-text string. The DB has a `Category` table with IDs. For now, store as product attribute; future work can normalize.
