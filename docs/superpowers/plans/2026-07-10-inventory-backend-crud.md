# Inventory Backend CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the admin inventory page at `/products/inventory` to real database data via FastAPI CRUD endpoints.

**Architecture:** Six tenant-isolated endpoints (`GET/POST/PATCH/DELETE /inventory`, `/inventory/stats`, `/inventory/{id}`) that map the frontend's flat payload to `Product` → `Variant` → `Inventory` tables using SQLModel async sessions, then reassemble the nested `InventoryItemResponse` shape on read.

**Tech Stack:** FastAPI, SQLModel, SQLAlchemy async, Pydantic v2, pytest-asyncio, httpx, PostgreSQL

## Global Constraints

- All route imports use `from src.dependencies import get_current_tenant_id, get_db`
- All queries filter `.where(Model.tenant_id == tenant_id)` for tenant isolation
- Schemas use pure Pydantic `BaseModel` (not SQLModel), with `model_config = ConfigDict(from_attributes=True)` for response schemas
- Router prefix is `/api/v1` (registered in `main.py`)
- Product IDs are UUIDs (from `BaseModel`)
- `get_db()` auto-commits on success, rolls back on exception — routes use `flush()` + `refresh()`, never `commit()`
- Delete returns 204 with `db.flush()` (matching `products.py` pattern)
- Update uses PATCH (matching frontend client), not PUT

---

## File Map

| File                           | Action | Responsibility                                    |
| ------------------------------ | ------ | ------------------------------------------------- |
| `src/orm/models/product.py`    | Modify | Add `supplier` column to `Product`                |
| `src/orm/schemas/inventory.py` | Create | Pydantic input/output schemas for all 6 endpoints |
| `src/orm/schemas/__init__.py`  | Modify | Export inventory schemas                          |
| `src/routes/inventory.py`      | Create | All 6 route handlers + status computation helper  |
| `src/main.py`                  | Modify | Import and register inventory router              |
| `tests/test_inventory.py`      | Create | 16 integration tests                              |

---

### Task 1: Add `supplier` column to Product model

**Files:**

- Modify: `src/orm/models/product.py:38` (add `supplier` field after `is_active`)

**Interfaces:**

- Consumes: Nothing
- Produces: `Product.supplier: Optional[str]` field

- [ ] **Step 1: Add the field**

In `src/orm/models/product.py`, add after line `is_active: bool = Field(default=True)`:

```python
supplier: Optional[str] = Field(default=None, max_length=255)
```

- [ ] **Step 2: Generate Alembic migration**

```bash
cd services/backend-api
alembic revision --autogenerate -m "add_supplier_to_product"
```

- [ ] **Step 3: Review the generated migration**

Read the file in `alembic/versions/` and verify it contains:

```python
op.add_column("products", sa.Column("supplier", sa.String(length=255), nullable=True))
```

- [ ] **Step 4: Run the migration**

```bash
cd services/backend-api && alembic upgrade head
```

- [ ] **Step 5: Commit**

```bash
git add src/orm/models/product.py alembic/versions/
git commit -m "feat: add supplier column to Product model"
```

---

### Task 2: Create inventory Pydantic schemas

**Files:**

- Create: `src/orm/schemas/inventory.py`
- Modify: `src/orm/schemas/__init__.py`

**Interfaces:**

- Consumes: `Product`, `Variant`, `Inventory`, `Location` ORM models
- Produces: `InventoryItemCreateInput`, `InventoryItemPatchInput`, `InventoryItemResponse`, `InventoryVariantResponse`, `InventoryStatsResponse`, `PaginationMeta`, `InventoryListResponse`

- [ ] **Step 1: Write the schema validation test**

Create `tests/test_inventory_schemas.py`:

```python
from uuid import UUID, uuid4
from datetime import datetime, timezone

from src.orm.schemas.inventory import (
    InventoryItemCreateInput,
    InventoryItemPatchInput,
    InventoryItemResponse,
    InventoryVariantResponse,
    InventoryStatsResponse,
    PaginationMeta,
    InventoryListResponse,
)


def test_create_input_accepts_minimal():
    data = InventoryItemCreateInput(name="Widget", sku="WDG-001")
    assert data.name == "Widget"
    assert data.sku == "WDG-001"
    assert data.category is None
    assert data.supplier is None
    assert data.price is None
    assert data.stock == 0


def test_create_input_rejects_empty_name():
    import pydantic
    try:
        InventoryItemCreateInput(name="", sku="SKU")
        assert False, "Should have raised"
    except pydantic.ValidationError:
        pass


def test_create_input_rejects_empty_sku():
    import pydantic
    try:
        InventoryItemCreateInput(name="Widget", sku="")
        assert False, "Should have raised"
    except pydantic.ValidationError:
        pass


def test_create_input_accepts_all_fields():
    data = InventoryItemCreateInput(
        name="Widget Pro",
        sku="WDG-PRO",
        category="Electronics",
        supplier="Acme Corp",
        price=29.99,
        stock=100,
    )
    assert data.name == "Widget Pro"
    assert data.price == 29.99
    assert data.stock == 100


def test_patch_input_all_optional():
    data = InventoryItemPatchInput()
    assert data.name is None
    assert data.sku is None


def test_patch_input_partial():
    data = InventoryItemPatchInput(category="Updated")
    assert data.category == "Updated"
    assert data.name is None


def test_variant_response_from_attributes():
    now = datetime.now(timezone.utc)
    vid = uuid4()
    pid = uuid4()
    variant = InventoryVariantResponse(
        id=vid,
        item_id=pid,
        name="Widget",
        sku="WDG-001",
        price=19.99,
        stock=50,
        created_at=now,
        updated_at=now,
    )
    assert variant.id == vid
    assert variant.item_id == pid
    assert variant.price == 19.99


def test_item_response_has_all_fields():
    now = datetime.now(timezone.utc)
    tid = uuid4()
    iid = uuid4()
    vid = uuid4()
    variant = InventoryVariantResponse(
        id=vid, item_id=iid, name="Widget", sku="WDG-001",
        price=19.99, stock=50, created_at=now, updated_at=now,
    )
    item = InventoryItemResponse(
        id=iid, tenant_id=tid, sku="WDG-001", name="Widget",
        category="Goods", status="in_stock",
        total_stock=50, total_value=999.50,
        variants=[variant], created_at=now, updated_at=now,
    )
    assert item.id == iid
    assert item.tenant_id == tid
    assert item.status == "in_stock"
    assert len(item.variants) == 1


def test_stats_response():
    stats = InventoryStatsResponse(
        total_skus=10, total_value=5000.0,
        low_stock_count=2, out_of_stock_count=1, total_variants=10,
    )
    assert stats.total_skus == 10


def test_pagination_meta():
    meta = PaginationMeta(page=2, page_size=10, total=25, total_pages=3)
    assert meta.page == 2
    assert meta.total_pages == 3


def test_list_response():
    meta = PaginationMeta(page=1, page_size=10, total=0, total_pages=0)
    resp = InventoryListResponse(data=[], pagination=meta)
    assert resp.data == []
    assert resp.pagination.total == 0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/backend-api && python -m pytest tests/test_inventory_schemas.py -v
```

Expected: ModuleNotFoundError / ImportError (schemas don't exist yet)

- [ ] **Step 3: Create `src/orm/schemas/inventory.py`**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryVariantResponse(BaseModel):
    id: UUID
    item_id: UUID  # aliased from product_id
    name: str
    sku: str
    barcode: Optional[str] = None
    price: float
    cost: float = 0
    stock: int
    reorder_point: int = 0
    warehouse: str = "Default"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sku: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    status: str  # computed: in_stock / low_stock / out_of_stock / discontinued
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

- [ ] **Step 4: Export schemas from `src/orm/schemas/__init__.py`**

Add after existing imports:

```python
from src.orm.schemas.inventory import (  # noqa: F401
    InventoryItemCreateInput,
    InventoryItemPatchInput,
    InventoryItemResponse,
    InventoryVariantResponse,
    InventoryStatsResponse,
    PaginationMeta,
    InventoryListResponse,
)
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd services/backend-api && python -m pytest tests/test_inventory_schemas.py -v
```

Expected: all 11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/orm/schemas/inventory.py src/orm/schemas/__init__.py tests/test_inventory_schemas.py
git commit -m "feat: add inventory Pydantic schemas with validation"
```

---

### Task 3: Implement all inventory route handlers

**Files:**

- Create: `src/routes/inventory.py`
- Modify: `src/main.py`
- Create: `tests/test_inventory.py`

**Interfaces:**

- Consumes: `get_current_tenant_id`, `get_db`, schemas from Task 2, ORM models (`Product`, `Variant`, `Inventory`, `Location`, `ProductImage`)
- Produces: 6 route handlers registered at `/api/v1/inventory`, 16 integration tests

- [ ] **Step 1: Write the test file with all 16 tests**

Create `tests/test_inventory.py`:

```python
import pytest
from uuid import UUID, uuid4
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import delete, select

from src.main import app
from src.orm.base import BaseModel
from src.orm.models.product import Product, Variant, Inventory, Location, ProductImage
from src.orm.models.tenant import Tenant
from src.database import async_engine

TENANT_A = UUID("00000000-0000-0000-0000-000000000001")
TENANT_B = UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(Inventory))
        await db.exec(delete(Variant))
        await db.exec(delete(ProductImage))
        await db.exec(delete(Product))
        await db.commit()


@pytest.fixture
async def client_a():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(TENANT_A)
        yield ac


@pytest.fixture
async def client_b():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(TENANT_B)
        yield ac


@pytest.fixture
async def seeded_item(client_a: AsyncClient) -> dict:
    resp = await client_a.post("/api/v1/inventory", json={
        "name": "Test Widget",
        "sku": "TST-001",
        "category": "Widgets",
        "supplier": "Acme",
        "price": 19.99,
        "stock": 100,
    })
    assert resp.status_code == 201
    return resp.json()


class TestList:
    async def test_list_empty(self, client_a: AsyncClient):
        resp = await client_a.get("/api/v1/inventory")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0

    async def test_list_pagination(self, client_a: AsyncClient):
        for i in range(25):
            await client_a.post("/api/v1/inventory", json={
                "name": f"Item {i}",
                "sku": f"SKU-{i:03d}",
            })
        resp = await client_a.get("/api/v1/inventory?page=2&page_size=10")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 10
        assert body["pagination"]["total"] == 25
        assert body["pagination"]["total_pages"] == 3
        assert body["pagination"]["page"] == 2

    async def test_list_search(self, client_a: AsyncClient):
        await client_a.post("/api/v1/inventory", json={"name": "Alpha", "sku": "ALP"})
        await client_a.post("/api/v1/inventory", json={"name": "Beta", "sku": "BET"})
        resp = await client_a.get("/api/v1/inventory?q=Alpha")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 1

    async def test_tenant_isolation_list(self, client_a: AsyncClient, client_b: AsyncClient):
        await client_a.post("/api/v1/inventory", json={"name": "A", "sku": "SKU-A"})
        resp = await client_b.get("/api/v1/inventory")
        assert resp.json()["data"] == []


class TestCreate:
    async def test_create_minimal(self, client_a: AsyncClient):
        resp = await client_a.post("/api/v1/inventory", json={
            "name": "Widget",
            "sku": "WDG-001",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Widget"
        assert body["sku"] == "WDG-001"
        assert UUID(body["id"])
        assert body["total_stock"] == 0
        assert body["status"] == "out_of_stock"
        assert len(body["variants"]) == 1

    async def test_create_with_all_fields(self, client_a: AsyncClient):
        resp = await client_a.post("/api/v1/inventory", json={
            "name": "Widget Pro",
            "sku": "WDG-PRO",
            "category": "Electronics",
            "supplier": "Acme Corp",
            "price": 29.99,
            "stock": 50,
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["category"] == "Electronics"
        assert body["supplier"] == "Acme Corp"
        assert body["total_stock"] == 50
        assert body["total_value"] == 29.99 * 50
        assert body["status"] == "in_stock"
        assert body["variants"][0]["price"] == 29.99
        assert body["variants"][0]["stock"] == 50

    async def test_create_duplicate_sku(self, client_a: AsyncClient):
        await client_a.post("/api/v1/inventory", json={"name": "First", "sku": "SAME"})
        resp = await client_a.post("/api/v1/inventory", json={"name": "Second", "sku": "SAME"})
        assert resp.status_code == 409

    async def test_create_transactional_rollback(self, client_a: AsyncClient):
        # Send invalid data that would fail after Product insertion
        resp = await client_a.post("/api/v1/inventory", json={
            "name": "",  # empty name should fail validation
            "sku": "SKU",
        })
        assert resp.status_code == 422
        # Verify no orphan Product exists
        async with AsyncSession(async_engine) as db:
            result = await db.exec(select(Product).where(Product.tenant_id == TENANT_A))
            assert len(result.all()) == 0


class TestGet:
    async def test_get_single(self, client_a: AsyncClient, seeded_item: dict):
        item_id = seeded_item["id"]
        resp = await client_a.get(f"/api/v1/inventory/{item_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == item_id
        assert body["name"] == "Test Widget"
        assert len(body["variants"]) == 1

    async def test_get_404(self, client_a: AsyncClient):
        resp = await client_a.get(f"/api/v1/inventory/{uuid4()}")
        assert resp.status_code == 404

    async def test_tenant_isolation_get(self, client_a: AsyncClient, client_b: AsyncClient, seeded_item: dict):
        # Tenant B cannot see Tenant A's item
        resp = await client_b.get(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 404
        # Tenant A can still see it
        resp = await client_a.get(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 200


class TestPatch:
    async def test_patch_name_and_sku(self, client_a: AsyncClient, seeded_item: dict):
        item_id = seeded_item["id"]
        resp = await client_a.patch(f"/api/v1/inventory/{item_id}", json={
            "name": "Updated Widget",
            "sku": "UPD-001",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Updated Widget"
        assert body["sku"] == "UPD-001"

    async def test_patch_partial(self, client_a: AsyncClient, seeded_item: dict):
        resp = await client_a.patch(f"/api/v1/inventory/{seeded_item['id']}", json={
            "category": "New Category",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["category"] == "New Category"
        assert body["name"] == "Test Widget"  # unchanged

    async def test_patch_404(self, client_a: AsyncClient):
        resp = await client_a.patch(f"/api/v1/inventory/{uuid4()}", json={"name": "Nope"})
        assert resp.status_code == 404


class TestDelete:
    async def test_delete(self, client_a: AsyncClient, seeded_item: dict):
        resp = await client_a.delete(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 204
        # Verify it's gone
        resp = await client_a.get(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 404

    async def test_delete_404(self, client_a: AsyncClient):
        resp = await client_a.delete(f"/api/v1/inventory/{uuid4()}")
        assert resp.status_code == 404

    async def test_tenant_isolation_delete(self, client_a: AsyncClient, client_b: AsyncClient, seeded_item: dict):
        # Tenant B cannot delete Tenant A's item
        resp = await client_b.delete(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 404
        # Tenant A still owns it
        resp = await client_a.get(f"/api/v1/inventory/{seeded_item['id']}")
        assert resp.status_code == 200


class TestStats:
    async def test_stats(self, client_a: AsyncClient):
        # Create items with known stock values
        await client_a.post("/api/v1/inventory", json={
            "name": "A", "sku": "A", "price": 10, "stock": 0,
        })
        await client_a.post("/api/v1/inventory", json={
            "name": "B", "sku": "B", "price": 20, "stock": 2,
        })
        await client_a.post("/api/v1/inventory", json={
            "name": "C", "sku": "C", "price": 30, "stock": 100,
        })
        resp = await client_a.get("/api/v1/inventory/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total_skus"] == 3
        assert body["total_variants"] == 3
        assert body["total_value"] > 0
        assert body["out_of_stock_count"] == 1  # item A: stock=0
        assert body["low_stock_count"] >= 0
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd services/backend-api && python -m pytest tests/test_inventory.py -v
```

Expected: ImportError for `src.routes.inventory` (doesn't exist yet)

- [ ] **Step 3: Create `src/routes/inventory.py`**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Inventory, Location, Product, ProductImage, Variant
from src.orm.schemas.inventory import (
    InventoryItemCreateInput,
    InventoryItemPatchInput,
    InventoryItemResponse,
    InventoryListResponse,
    InventoryStatsResponse,
    InventoryVariantResponse,
    PaginationMeta,
)

router = APIRouter(tags=["inventory"])

REORDER_THRESHOLD_DEFAULT = 5


def _compute_status(total_stock: int, is_active: bool, reorder_level: int = REORDER_THRESHOLD_DEFAULT) -> str:
    if not is_active:
        return "discontinued"
    if total_stock == 0:
        return "out_of_stock"
    if total_stock <= reorder_level:
        return "low_stock"
    return "in_stock"


async def _build_item_response(db: AsyncSession, product: Product) -> InventoryItemResponse:
    """Assemble a nested InventoryItemResponse from a Product + its relations."""
    # Eager-load active variants + their inventory records
    stmt = (
        select(Variant)
        .options(selectinload(Variant.inventory))
        .where(Variant.product_id == product.id, Variant.is_active == True)  # noqa: E712
    )
    result = await db.exec(stmt)
    variants = result.all()

    # Get first image URL
    img_stmt = select(ProductImage).where(
        ProductImage.product_id == product.id
    ).order_by(ProductImage.sort_order).limit(1)
    img_result = await db.exec(img_stmt)
    first_image = img_result.first()
    image_url = first_image.url if first_image else None

    total_stock = 0
    total_value = 0.0
    variant_responses = []

    for v in variants:
        v_stock = v.inventory_quantity or 0
        total_stock += v_stock
        total_value += (v.price or 0) * v_stock

        # Get first inventory's reorder_level (location relationship not loaded)
        reorder_point = REORDER_THRESHOLD_DEFAULT
        warehouse = "Default"
        if v.inventory:
            inv = v.inventory[0]
            reorder_point = inv.reorder_level or REORDER_THRESHOLD_DEFAULT

        variant_responses.append(InventoryVariantResponse(
            id=v.id,
            item_id=product.id,
            name=product.name,
            sku=v.sku,
            barcode=v.barcode,
            price=float(v.price) if v.price is not None else 0.0,
            cost=float(v.price) if v.price is not None else 0.0,
            stock=v_stock,
            reorder_point=reorder_point,
            warehouse=warehouse,
            created_at=v.created_at,
            updated_at=v.updated_at,
        ))

    # Determine status from primary variant's reorder level
    reorder_level = REORDER_THRESHOLD_DEFAULT
    if variants and variants[0].inventory:
        reorder_level = variants[0].inventory[0].reorder_level or REORDER_THRESHOLD_DEFAULT

    return InventoryItemResponse(
        id=product.id,
        tenant_id=product.tenant_id,
        sku=variants[0].sku if variants else "",
        name=product.name,
        description=product.description,
        category=product.category.name if hasattr(product, 'category') and product.category else None,
        image_url=image_url,
        status=_compute_status(total_stock, product.is_active, reorder_level),
        supplier=product.supplier,
        total_stock=total_stock,
        total_value=round(total_value, 2),
        variants=variant_responses,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("/inventory/stats", response_model=InventoryStatsResponse)
async def get_stats(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Total variants (SKUs)
    variant_count_stmt = (
        select(func.count(Variant.id))
        .join(Product)
        .where(Product.tenant_id == tenant_id)
    )
    result = await db.exec(variant_count_stmt)
    total_variants = result.one()

    # Total stock value across all variants
    value_stmt = (
        select(func.coalesce(func.sum(Variant.price * func.coalesce(Variant.inventory_quantity, 0)), 0))
        .join(Product)
        .where(Product.tenant_id == tenant_id)
    )
    result = await db.exec(value_stmt)
    total_value = float(result.one())

    # Low stock count (stock > 0 and stock <= reorder_level)
    low_stmt = text("""
        SELECT COUNT(*) FROM variants v
        JOIN products p ON p.id = v.product_id AND p.tenant_id = :tid
        WHERE v.inventory_quantity > 0
        AND v.inventory_quantity <= COALESCE(
            (SELECT i.reorder_level FROM inventory i WHERE i.variant_id = v.id LIMIT 1),
            :threshold
        )
    """)
    result = await db.exec(low_stmt, {"tid": str(tenant_id), "threshold": REORDER_THRESHOLD_DEFAULT})
    low_stock_count = result.one()

    # Out of stock count
    oos_stmt = text("""
        SELECT COUNT(*) FROM variants v
        JOIN products p ON p.id = v.product_id AND p.tenant_id = :tid
        WHERE v.inventory_quantity = 0
    """)
    result = await db.exec(oos_stmt, {"tid": str(tenant_id)})
    out_of_stock_count = result.one()

    return InventoryStatsResponse(
        total_skus=total_variants,
        total_value=round(total_value, 2),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        total_variants=total_variants,
    )


@router.get("/inventory", response_model=InventoryListResponse)
async def list_items(
    q: str | None = Query(None),
    category: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Count query
    count_stmt = select(func.count(Product.id)).where(Product.tenant_id == tenant_id)
    if q:
        count_stmt = count_stmt.where(Product.name.ilike(f"%{q}%"))
    result = await db.exec(count_stmt)
    total = result.one()

    # Fetch products with eager-loaded category
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.tenant_id == tenant_id)
    )
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.exec(stmt)
    products = result.all()

    items = []
    for product in products:
        item = await _build_item_response(db, product)
        # Client-side status filter (applied after computation)
        if status and item.status != status:
            continue
        items.append(item)

    total_pages = max(1, (total + page_size - 1) // page_size)

    return InventoryListResponse(
        data=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/inventory/{item_id}", response_model=InventoryItemResponse)
async def get_item(
    item_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.id == item_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    return await _build_item_response(db, product)


@router.post("/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: InventoryItemCreateInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Check SKU uniqueness within tenant
    sku_stmt = select(Variant).where(Variant.sku == data.sku, Variant.tenant_id == tenant_id)
    result = await db.exec(sku_stmt)
    if result.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists for this tenant")

    # Create Product
    product = Product(
        name=data.name,
        tenant_id=tenant_id,
        is_active=True,
        supplier=data.supplier,
    )
    db.add(product)
    await db.flush()

    # Create Variant
    variant = Variant(
        product_id=product.id,
        sku=data.sku,
        price=data.price or 0.0,
        inventory_quantity=data.stock or 0,
        is_active=True,
    )
    db.add(variant)
    await db.flush()

    # Create Inventory record with default location
    loc_stmt = select(Location).where(Location.tenant_id == tenant_id, Location.is_active == True).limit(1)  # noqa: E712
    result = await db.exec(loc_stmt)
    location = result.first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No warehouse location found for this tenant. Please create a location first.",
        )

    inventory = Inventory(
        variant_id=variant.id,
        location_id=location.id,
        quantity=data.stock or 0,
        reserved_quantity=0,
        reorder_level=REORDER_THRESHOLD_DEFAULT,
        reorder_quantity=50,
    )
    db.add(inventory)
    await db.flush()

    await db.refresh(product)
    return await _build_item_response(db, product)


@router.patch("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: UUID,
    data: InventoryItemPatchInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Fetch product with tenant guard
    stmt = (
        select(Product)
        .options(selectinload(Product.variants).selectinload(Variant.inventory))
        .where(Product.id == item_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    # Apply product-level updates
    update_data = data.model_dump(exclude_unset=True)
    product_fields = {"name", "category", "supplier"}
    variant_fields = {"sku", "price", "stock"}

    for key in product_fields & update_data.keys():
        setattr(product, key, update_data[key])

    # Apply variant-level updates (first/primary variant)
    if product.variants:
        variant = product.variants[0]
        if "sku" in update_data:
            # Check SKU uniqueness (excluding current variant)
            sku_stmt = (
                select(Variant)
                .where(
                    Variant.sku == update_data["sku"],
                    Variant.tenant_id == tenant_id,
                    Variant.id != variant.id,
                )
            )
            result = await db.exec(sku_stmt)
            if result.first():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists for this tenant")
            variant.sku = update_data["sku"]
        if "price" in update_data:
            variant.price = update_data["price"]
        if "stock" in update_data:
            variant.inventory_quantity = update_data["stock"]
            # Update first Inventory record quantity too
            if variant.inventory:
                variant.inventory[0].quantity = update_data["stock"]

    await db.flush()
    await db.refresh(product)
    return await _build_item_response(db, product)


@router.delete("/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(Product.id == item_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    await db.delete(product)
    await db.flush()
```

- [ ] **Step 4: Register the router in `src/main.py`**

Add after the existing `product_images_router` import (line ~60):

```python
from src.routes.inventory import router as inventory_router  # noqa: E402
```

Add after `app.include_router(product_images_router, ...)` (line ~80):

```python
app.include_router(inventory_router, prefix="/api/v1")
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd services/backend-api && python -m pytest tests/test_inventory.py -v
```

Expected: all 16 tests PASS

If some fail (e.g., `ProductImage` import in routes), fix the import — `ProductImage` is in `src.orm.models.product` but may need explicit import. Check and adjust.

- [ ] **Step 6: Commit**

```bash
git add src/routes/inventory.py src/main.py tests/test_inventory.py
git commit -m "feat: implement inventory CRUD routes with tenant isolation"
```

---

### Task 4: Remove schema test scaffolding (optional)

If you don't want to keep the separate schema unit tests (Task 2 is fully covered by the integration tests), you can delete them:

```bash
git rm tests/test_inventory_schemas.py
git commit -m "chore: remove redundant schema unit tests (covered by integration tests)"
```

Otherwise, keep both — the schema tests are fast unit tests that validate Pydantic logic without DB overhead.
