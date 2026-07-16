# Dashboard, Customers & Collections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin dashboard with real KPI metrics, customer management pages, and many-to-many collections feature.

**Architecture:** Database-first (2 migrations), then backend API layer (customers, dashboard aggregator, collections CRUD), then admin UI (dashboard, customer pages, collection management), ending with storefront collection routes.

**Tech Stack:** FastAPI + SQLModel + Alembic on backend; Next.js + shadcn/ui + TanStack Query on frontend; PostgreSQL with RLS.

## Global Constraints

- All monetary values stored as `BIGINT` (cents/pence) in new tables. API returns cents. UI divides by 100: `£{(n/100).toFixed(2)}`
- Existing `orders.total` remains FLOAT (pounds). DB trigger converts to cents via `CAST(total * 100 AS BIGINT)`.
- All MTD calculations use `NOW() AT TIME ZONE 'UTC'` — canonical reporting timezone.
- AOV guard: `total_spent // total_orders if total_orders > 0 else 0` everywhere.
- Collections use soft delete (`is_active = false`), returning 200 idempotent.
- RLS pool reset in DB dependency `finally` block, not shutdown event.
- Follow existing patterns in `routes/categories.py` for CRUD, `orm/models/category.py` for models.

---

### Task 1: Migration 0005 — Customers + CustomerAddresses

**Files:**

- Create: `services/backend-api/alembic/versions/0005_add_customers.py`
- Test: `services/backend-api/tests/test_migrations.py` (verify migration applies/rolls back)

**Interfaces:**

- Consumes: Existing `customers` table does NOT exist yet (only in model definition)
- Produces: `customers` and `customer_addresses` tables with RLS + DB trigger `sync_customer_agg()`

- [ ] **Step 1: Read the existing migration pattern**

Read `services/backend-api/alembic/versions/0004_add_categories.py` as reference. Copy its structure: hand-written SQL in `upgrade()`/`downgrade()`, RLS policy, index creation.

- [ ] **Step 2: Write migration `0005_add_customers.py`**

Create the file:

```python
"""add customers and customer_addresses tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(50),
            is_verified BOOLEAN NOT NULL DEFAULT false,
            total_orders INTEGER NOT NULL DEFAULT 0,
            total_spent BIGINT NOT NULL DEFAULT 0,
            refunded_total BIGINT NOT NULL DEFAULT 0,
            last_order_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_customers_tenant_email
        ON customers (tenant_id, email)
    """)
    op.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_customers ON customers
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    # Update existing customers FK on orders (was added manually but table didn't exist)
    op.execute("""
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_addresses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            address_type VARCHAR(50) NOT NULL DEFAULT 'shipping',
            line1 VARCHAR(255) NOT NULL,
            line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            province VARCHAR(100),
            postal_code VARCHAR(20) NOT NULL,
            country VARCHAR(100) NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_default_address
        ON customer_addresses (customer_id, address_type) WHERE is_default = true
    """)
    op.execute("ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_customer_addresses ON customer_addresses
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    # Trigger function to keep customers.total_orders/spent/refunded in sync
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_customer_agg()
        RETURNS TRIGGER AS $$
        DECLARE
          agg RECORD;
        BEGIN
          IF TG_OP = 'INSERT' AND NEW.payment_status IN ('PAID', 'REFUNDED') THEN
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
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
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
            INTO agg
            FROM orders
            WHERE customer_id = NEW.customer_id AND tenant_id = NEW.tenant_id;

            UPDATE customers
            SET total_orders = agg.cnt,
                total_spent = agg.paid,
                refunded_total = agg.refunded,
                last_order_at = GREATEST(last_order_at, NEW.created_at)
            WHERE id = NEW.customer_id;
          ELSIF TG_OP = 'DELETE' THEN
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total * 100) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
            INTO agg
            FROM orders
            WHERE customer_id = OLD.customer_id AND tenant_id = OLD.tenant_id;

            UPDATE customers
            SET total_orders = agg.cnt,
                total_spent = agg.paid,
                refunded_total = agg.refunded
            WHERE id = OLD.customer_id;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_sync_customer_agg
        AFTER INSERT OR UPDATE OF payment_status, total OR DELETE
        ON orders
        FOR EACH ROW
        EXECUTE FUNCTION sync_customer_agg()
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sync_customer_agg ON orders")
    op.execute("DROP FUNCTION IF EXISTS sync_customer_agg")
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_customer_addresses ON customer_addresses")
    op.execute("ALTER TABLE customer_addresses DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS uq_customer_default_address")
    op.execute("DROP TABLE IF EXISTS customer_addresses")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_customers ON customers")
    op.execute("ALTER TABLE customers DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_customers_tenant_email")
    op.execute("DROP TABLE IF EXISTS customers")
```

- [ ] **Step 3: Apply the migration**

Run:

```bash
cd services/backend-api
alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 0004 -> 0005`

- [ ] **Step 4: Verify tables exist**

Run:

```bash
psql "$DATABASE_URL" -c "\dt customers customer_addresses"
```

Expected: Both tables listed.

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/alembic/versions/0005_add_customers.py
git commit -m "feat(db): add customers and customer_addresses tables with RLS and sync trigger"
```

---

### Task 2: Migration 0006 — Collections + ProductCollections

**Files:**

- Create: `services/backend-api/alembic/versions/0006_add_collections.py`
- Test: verify migration applies and rolls back

**Interfaces:**

- Produces: `collections` and `product_collections` tables with RLS

- [ ] **Step 1: Write migration `0006_add_collections.py`**

```python
"""add collections and product_collections tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS collections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            hero_image_url VARCHAR(2048),
            hero_image_alt VARCHAR(500),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_collections_tenant_slug
        ON collections (tenant_id, slug)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collections_tenant_active
        ON collections (tenant_id, is_active)
    """)
    op.execute("ALTER TABLE collections ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_collections ON collections
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS product_collections (
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (product_id, collection_id)
        )
    """)
    op.execute("ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_product_collections ON product_collections
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_product_collections ON product_collections")
    op.execute("ALTER TABLE product_collections DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS product_collections")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_collections ON collections")
    op.execute("ALTER TABLE collections DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_collections_tenant_active")
    op.execute("DROP INDEX IF EXISTS ix_collections_tenant_slug")
    op.execute("DROP TABLE IF EXISTS collections")
```

- [ ] **Step 2: Apply the migration**

```bash
cd services/backend-api
alembic upgrade head
```

Expected: `Running upgrade 0005 -> 0006`

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/alembic/versions/0006_add_collections.py
git commit -m "feat(db): add collections and product_collections tables with RLS"
```

---

### Task 3: Collection ORM Model + Pydantic Schemas

**Files:**

- Create: `services/backend-api/src/orm/models/collection.py`
- Create: `services/backend-api/src/orm/schemas/collection.py`
- Modify: `services/backend-api/src/orm/models/product.py` (add `collections` Relationship)
- Modify: `services/backend-api/src/orm/models/__init__.py`
- Modify: `services/backend-api/src/orm/schemas/__init__.py`

**Interfaces:**

- Produces: `Collection` model, `ProductCollection` model, `CollectionCreate/Update/Response` schemas, `Product.collections` relationship

- [ ] **Step 1: Create `src/orm/models/collection.py`**

```python
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import DateTime, Index, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Product


class Collection(BaseModel, table=True):
    __tablename__ = "collections"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_collections_tenant_slug"),
        Index("ix_collections_tenant_active", "tenant_id", "is_active"),
    )

    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    hero_image_url: Optional[str] = Field(default=None, max_length=2048)
    hero_image_alt: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)

    products: list["Product"] = Relationship(back_populates="collections", link_model="ProductCollection")


class ProductCollection(SQLModel, table=True):
    __tablename__ = "product_collections"

    product_id: UUID = Field(foreign_key="products.id", primary_key=True)
    collection_id: UUID = Field(foreign_key="collections.id", primary_key=True)
    tenant_id: UUID = Field(index=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
        nullable=False,
    )
```

- [ ] **Step 2: Add Relationship to Product model**

Open `services/backend-api/src/orm/models/product.py`. Add to TYPE_CHECKING imports:

```python
if TYPE_CHECKING:
    from src.orm.models.category import Category
    from src.orm.models.collection import Collection
```

Add to the Product class body (after `category` relationship):

```python
    collections: list["Collection"] = Relationship(
        back_populates="products", link_model="ProductCollection"
    )
```

- [ ] **Step 3: Create `src/orm/schemas/collection.py`**

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CollectionCreate(BaseModel):
    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    sort_order: int = 0


class CollectionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    slug: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CollectionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    sort_order: int
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Update `orm/models/__init__.py`**

Add import:

```python
from src.orm.models.collection import Collection, ProductCollection  # noqa: F401
```

- [ ] **Step 5: Update `orm/schemas/__init__.py`**

Add import:

```python
from src.orm.schemas.collection import CollectionCreate, CollectionUpdate, CollectionResponse  # noqa: F401
```

- [ ] **Step 6: Move Customer schemas to dedicated file**

Create `services/backend-api/src/orm/schemas/customer.py`:

```python
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CustomerResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_verified: bool
    total_orders: int
    total_spent: int  # BIGINT cents
    last_order_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CustomerDetailResponse(CustomerResponse):
    average_order_value: int = 0  # BIGINT cents
    addresses: list["CustomerAddressResponse"] = []
    orders: list["CustomerOrderResponse"] = []


class CustomerAddressResponse(BaseModel):
    id: UUID
    address_type: str
    line1: str
    line2: Optional[str] = None
    city: str
    province: Optional[str] = None
    postal_code: str
    country: str
    is_default: bool

    model_config = {"from_attributes": True}


class CustomerOrderResponse(BaseModel):
    id: UUID
    order_number: str
    total: int  # cents
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

Remove the old `CustomerCreate`, `CustomerUpdate`, `CustomerResponse` classes from `src/orm/schemas/product.py`.

- [ ] **Step 7: Update schemas/**init**.py**

Add customer exports:

```python
from src.orm.schemas.customer import CustomerResponse, CustomerDetailResponse  # noqa: F401
```

- [ ] **Step 8: Run tests**

```bash
cd services/backend-api
pytest -x -v
```

Expected: All existing tests pass.

- [ ] **Step 9: Commit**

```bash
git add services/backend-api/src/orm/models/collection.py services/backend-api/src/orm/schemas/collection.py services/backend-api/src/orm/models/product.py services/backend-api/src/orm/models/__init__.py services/backend-api/src/orm/schemas/__init__.py services/backend-api/src/orm/schemas/customer.py services/backend-api/src/orm/schemas/product.py
git commit -m "feat(api): add Collection model, schemas, and refactor Customer schemas"
```

---

### Task 4: Collection CRUD Routes (Admin)

**Files:**

- Create: `services/backend-api/src/routes/collections.py`
- Modify: `services/backend-api/src/main.py` (register router)
- Create: `services/backend-api/tests/test_collections.py`

**Interfaces:**

- Produces: `GET/POST/PUT/DELETE /api/v1/collections/`, `GET/POST/PUT/DEL /collections/{id}/products`
- Consumes: `Collection`, `ProductCollection` models, `CollectionCreate/Update/Response` schemas

- [ ] **Step 1: Write `src/routes/collections.py`**

Follow the exact pattern from `routes/categories.py`:

```python
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func, delete

from src.dependencies import get_db, get_current_tenant_id
from src.orm.models.collection import Collection, ProductCollection
from src.orm.models.product import Product
from src.orm.schemas.collection import CollectionCreate, CollectionUpdate, CollectionResponse

router = APIRouter(tags=["collections"])


@router.get("/collections/", response_model=list[CollectionResponse])
async def list_collections(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    include_inactive: bool = False,
):
    stmt = select(Collection).where(Collection.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Collection.is_active == True)
    stmt = stmt.order_by(Collection.sort_order, Collection.name)
    collections = (await db.exec(stmt)).all()
    result = []
    for col in collections:
        count_stmt = select(func.count()).select_from(ProductCollection).where(
            ProductCollection.collection_id == col.id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CollectionResponse(
            **col.model_dump(),
            product_count=count,
        ))
    return result


@router.post("/collections/", response_model=CollectionResponse)
async def create_collection(
    data: CollectionCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    col = Collection(**data.model_dump(), tenant_id=tenant_id)
    db.add(col)
    await db.commit()
    await db.refresh(col)
    return CollectionResponse(**col.model_dump(), product_count=0)


@router.put("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: UUID,
    data: CollectionUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(col, key, value)
    await db.commit()
    await db.refresh(col)
    count_stmt = select(func.count()).select_from(ProductCollection).where(
        ProductCollection.collection_id == col.id,
    )
    count = (await db.exec(count_stmt)).one()
    return CollectionResponse(**col.model_dump(), product_count=count)


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Soft delete — sets is_active = false, preserves product links."""
    stmt = select(Collection).where(
        Collection.id == collection_id,
        Collection.tenant_id == tenant_id,
    )
    col = (await db.exec(stmt)).one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    if not col.is_active:
        return {"status": "already_inactive"}
    col.is_active = False
    await db.commit()
    return {"status": "deactivated"}


# ── Product management within a collection ──


@router.get("/collections/{collection_id}/products", response_model=list[dict])
async def list_collection_products(
    collection_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Product)
        .join(ProductCollection, Product.id == ProductCollection.product_id)
        .where(
            ProductCollection.collection_id == collection_id,
            Product.tenant_id == tenant_id,
        )
        .order_by(ProductCollection.sort_order)
    )
    products = (await db.exec(stmt)).all()
    return products


@router.post("/collections/{collection_id}/products")
async def add_products_to_collection(
    collection_id: UUID,
    body: dict,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    product_ids = body.get("product_ids", [])
    for pid in product_ids:
        link = ProductCollection(
            product_id=pid,
            collection_id=collection_id,
            tenant_id=tenant_id,
        )
        db.add(link)
    await db.commit()
    return {"added": len(product_ids)}


@router.delete("/collections/{collection_id}/products/{product_id}")
async def remove_product_from_collection(
    collection_id: UUID,
    product_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(ProductCollection).where(
        ProductCollection.collection_id == collection_id,
        ProductCollection.product_id == product_id,
        ProductCollection.tenant_id == tenant_id,
    )
    link = (await db.exec(stmt)).one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Product not in collection")
    await db.delete(link)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 2: Register router in `main.py`**

Add import:

```python
from src.routes.collections import router as collections_router  # noqa: E402
```

Add registration (after categories_router):

```python
app.include_router(collections_router, prefix="/api/v1")
```

- [ ] **Step 3: Write tests**

Create `services/backend-api/tests/test_collections.py`:

```python
"""Tests for collection CRUD endpoints."""

from uuid import uuid4
from httpx import AsyncClient, ASGITransport
import pytest
from src.main import app
from src.database import async_engine
from src.orm.base import BaseModel


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)


@pytest.fixture
def tenant_id():
    return uuid4()


@pytest.fixture
async def client(tenant_id):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(tenant_id)
        yield ac


@pytest.mark.asyncio
async def test_create_collection(client):
    response = await client.post("/api/v1/collections/", json={
        "name": "Winter Collection",
        "slug": "winter-2026",
        "description": "Warm layers",
        "sort_order": 1,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Winter Collection"
    assert data["slug"] == "winter-2026"
    assert data["product_count"] == 0


@pytest.mark.asyncio
async def test_list_collections(client):
    await client.post("/api/v1/collections/", json={
        "name": "Summer",
        "slug": "summer-2026",
    })
    response = await client.get("/api/v1/collections/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Summer"


@pytest.mark.asyncio
async def test_soft_delete(client):
    resp = await client.post("/api/v1/collections/", json={
        "name": "Test",
        "slug": "test-collection",
    })
    cid = resp.json()["id"]
    resp = await client.delete(f"/api/v1/collections/{cid}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deactivated"


@pytest.mark.asyncio
async def test_soft_delete_idempotent(client):
    resp = await client.post("/api/v1/collections/", json={
        "name": "Test",
        "slug": "test-collection",
    })
    cid = resp.json()["id"]
    await client.delete(f"/api/v1/collections/{cid}")
    resp2 = await client.delete(f"/api/v1/collections/{cid}")
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "already_inactive"
```

- [ ] **Step 4: Run tests**

```bash
cd services/backend-api
APP_ENV=test pytest tests/test_collections.py -x -v
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/routes/collections.py services/backend-api/src/main.py services/backend-api/tests/test_collections.py
git commit -m "feat(api): add collections CRUD routes with soft delete and product management"
```

---

### Task 5: Customer CRUD Routes

**Files:**

- Create: `services/backend-api/src/routes/customers.py`
- Modify: `services/backend-api/src/main.py` (register router)
- Create: `services/backend-api/tests/test_customers.py`

**Interfaces:**

- Produces: `GET /api/v1/customers/` (paginated), `GET /api/v1/customers/{id}` (detail)
- Consumes: `Customer`, `CustomerAddress`, `Order` models, `CustomerResponse`, `CustomerDetailResponse`

- [ ] **Step 1: Write `src/routes/customers.py`**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlmodel import select, func

from src.dependencies import get_db, get_current_tenant_id
from src.orm.models.order import Customer, CustomerAddress, Order
from src.orm.schemas.customer import (
    CustomerResponse,
    CustomerDetailResponse,
    CustomerAddressResponse,
    CustomerOrderResponse,
)

router = APIRouter(tags=["customers"])


@router.get("/customers/")
async def list_customers(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
):
    stmt = select(Customer).where(Customer.tenant_id == tenant_id)
    if search:
        stmt = stmt.where(
            (Customer.email.ilike(f"%{search}%")) |
            (Customer.first_name.ilike(f"%{search}%")) |
            (Customer.last_name.ilike(f"%{search}%"))
        )
    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.exec(total_stmt)).one()

    stmt = stmt.order_by(Customer.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    customers = (await db.exec(stmt)).all()

    return {
        "data": [CustomerResponse.model_validate(c) for c in customers],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Customer)
        .options(selectinload(Customer.addresses), selectinload(Customer.orders))
        .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    )
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    aov = customer.total_spent // customer.total_orders if customer.total_orders > 0 else 0

    return CustomerDetailResponse(
        **customer.model_dump(),
        average_order_value=aov,
        addresses=[
            CustomerAddressResponse.model_validate(a) for a in customer.addresses
        ],
        orders=[
            CustomerOrderResponse(
                id=o.id,
                order_number=o.order_number,
                total=int(o.total * 100),  # convert pounds to cents
                status=o.status.value if hasattr(o.status, 'value') else o.status,
                created_at=o.created_at,
            )
            for o in customer.orders
        ],
    )
```

- [ ] **Step 2: Add `addresses` relationship to Customer model**

Open `src/orm/models/order.py`, add to `Customer` class body:

```python
    addresses: list["CustomerAddress"] = Relationship(back_populates="customer")
```

Add `back_populates` to `CustomerAddress`:

```python
    customer: "Customer" = Relationship(back_populates="addresses")
```

Note: `CustomerAddress` already has `customer_id` FK. Add the Relationship declarations.

- [ ] **Step 3: Register router in `main.py`**

Add import:

```python
from src.routes.customers import router as customers_router  # noqa: E402
```

Add registration (after orders_router):

```python
app.include_router(customers_router, prefix="/api/v1")
```

- [ ] **Step 4: Write tests**

Create `services/backend-api/tests/test_customers.py`:

```python
"""Tests for customer endpoints."""

import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from src.main import app
from src.database import async_engine
from src.orm.base import BaseModel


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)


@pytest.fixture
def tenant_id():
    return uuid4()


@pytest.fixture
async def client(tenant_id):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(tenant_id)
        yield ac


@pytest.mark.asyncio
async def test_list_customers_empty(client):
    response = await client.get("/api/v1/customers/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["data"] == []


@pytest.mark.asyncio
async def test_get_customer_not_found(client):
    response = await client.get(f"/api/v1/customers/{uuid4()}")
    assert response.status_code == 404
```

- [ ] **Step 5: Run tests**

```bash
cd services/backend-api
APP_ENV=test pytest tests/test_customers.py -x -v
```

Expected: Both tests pass.

- [ ] **Step 6: Commit**

```bash
git add services/backend-api/src/routes/customers.py services/backend-api/src/main.py services/backend-api/src/orm/models/order.py services/backend-api/tests/test_customers.py
git commit -m "feat(api): add customer list and detail routes with pagination"
```

---

### Task 6: Dashboard Aggregator Endpoint

**Files:**

- Create: `services/backend-api/src/routes/admin.py`
- Create: `services/backend-api/src/orm/schemas/dashboard.py`
- Modify: `services/backend-api/src/main.py` (register router)
- Create: `services/backend-api/tests/test_dashboard.py`

**Interfaces:**

- Produces: `GET /api/v1/admin/dashboard/summary`
- Consumes: `Order`, `Variant`, `Product`, `Customer` models

- [ ] **Step 1: Create `src/orm/schemas/dashboard.py`**

```python
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FulfillmentCounts(BaseModel):
    unfulfilled: int = 0
    processing: int = 0
    shipped: int = 0
    delivered: int = 0


class LowStockItem(BaseModel):
    variant_id: UUID
    product_name: str
    sku: str
    quantity: int
    threshold: int = 5


class RecentOrderItem(BaseModel):
    id: UUID
    order_number: str
    customer_name: Optional[str] = None
    total: int  # cents
    status: str
    created_at: str


class DashboardSummaryResponse(BaseModel):
    revenue_mtd: int = 0
    revenue_total: int = 0
    revenue_prev_mtd: int = 0
    orders_mtd: int = 0
    orders_total: int = 0
    orders_prev_mtd: int = 0
    aov: int = 0
    active_customers: int = 0
    active_customers_prev: int = 0
    fulfillment: FulfillmentCounts = FulfillmentCounts()
    low_stock: list[LowStockItem] = []
    recent_orders: list[RecentOrderItem] = []
```

- [ ] **Step 2: Create `src/routes/admin.py`**

```python
import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel import select, func, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_db, get_current_tenant_id
from src.orm.schemas.dashboard import (
    DashboardSummaryResponse,
    FulfillmentCounts,
    LowStockItem,
    RecentOrderItem,
)

router = APIRouter(tags=["admin"])


async def _kpi_query(db: AsyncSession, tenant_id: UUID) -> dict:
    """Run KPI aggregation — 4 values, 1 query with CTEs."""
    sql = text("""
        WITH
        mtd AS (
            SELECT
                COALESCE(SUM(total * 100), 0)::BIGINT AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT customer_id) FILTER (WHERE payment_status = 'PAID') AS active_customers
            FROM orders
            WHERE tenant_id = :tenant_id
                AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
        ),
        prev_mtd AS (
            SELECT
                COALESCE(SUM(total * 100), 0)::BIGINT AS revenue,
                COUNT(*) AS orders,
                COUNT(DISTINCT customer_id) FILTER (WHERE payment_status = 'PAID') AS active_customers
            FROM orders
            WHERE tenant_id = :tenant_id
                AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
                AND created_at < LEAST(
                    date_trunc('month', NOW() AT TIME ZONE 'UTC') - INTERVAL '1 month'
                        + EXTRACT(DAY FROM NOW() AT TIME ZONE 'UTC') * INTERVAL '1 day',
                    date_trunc('month', NOW() AT TIME ZONE 'UTC')
                )
        ),
        total AS (
            SELECT
                COALESCE(SUM(total * 100), 0)::BIGINT AS revenue,
                COUNT(*) AS orders
            FROM orders
            WHERE tenant_id = :tenant_id
        )
        SELECT
            COALESCE(mtd.revenue, 0) AS revenue_mtd,
            COALESCE(prev_mtd.revenue, 0) AS revenue_prev_mtd,
            COALESCE(total.revenue, 0) AS revenue_total,
            mtd.orders::INTEGER AS orders_mtd,
            prev_mtd.orders::INTEGER AS orders_prev_mtd,
            total.orders::INTEGER AS orders_total,
            COALESCE(mtd.active_customers, 0)::INTEGER AS active_customers,
            COALESCE(prev_mtd.active_customers, 0)::INTEGER AS active_customers_prev
        FROM mtd, prev_mtd, total
    """)
    result = (await db.exec(sql, {"tenant_id": tenant_id})).one()
    aov = result.orders_mtd // result.revenue_mtd if result.revenue_mtd > 0 else 0
    return {
        "revenue_mtd": result.revenue_mtd,
        "revenue_prev_mtd": result.revenue_prev_mtd,
        "revenue_total": result.revenue_total,
        "orders_mtd": result.orders_mtd,
        "orders_prev_mtd": result.orders_prev_mtd,
        "orders_total": result.orders_total,
        "aov": aov,
        "active_customers": result.active_customers,
        "active_customers_prev": result.active_customers_prev,
    }


async def _fulfillment_query(db: AsyncSession, tenant_id: UUID) -> FulfillmentCounts:
    sql = text("""
        SELECT
            COALESCE(COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed')), 0)::INTEGER AS unfulfilled,
            COALESCE(COUNT(*) FILTER (WHERE status = 'processing'), 0)::INTEGER AS processing,
            COALESCE(COUNT(*) FILTER (WHERE status = 'shipped'), 0)::INTEGER AS shipped,
            COALESCE(COUNT(*) FILTER (WHERE status = 'delivered'), 0)::INTEGER AS delivered
        FROM orders
        WHERE tenant_id = :tenant_id
    """)
    result = (await db.exec(sql, {"tenant_id": tenant_id})).one()
    return FulfillmentCounts(
        unfulfilled=result.unfulfilled,
        processing=result.processing,
        shipped=result.shipped,
        delivered=result.delivered,
    )


async def _low_stock_query(db: AsyncSession, tenant_id: UUID) -> list[LowStockItem]:
    sql = text("""
        SELECT
            v.id AS variant_id,
            p.name AS product_name,
            v.sku,
            v.inventory_quantity AS quantity,
            5 AS threshold
        FROM variants v
        JOIN products p ON p.id = v.product_id
        WHERE v.tenant_id = :tenant_id
            AND v.inventory_quantity <= 5
            AND v.is_active = true
        ORDER BY v.inventory_quantity ASC
        LIMIT 20
    """)
    rows = (await db.exec(sql, {"tenant_id": tenant_id})).all()
    return [LowStockItem(**r._mapping) for r in rows]


async def _recent_orders_query(db: AsyncSession, tenant_id: UUID) -> list[RecentOrderItem]:
    sql = text("""
        SELECT
            o.id,
            o.order_number,
            COALESCE(c.first_name || ' ' || c.last_name, '') AS customer_name,
            (o.total * 100)::BIGINT AS total,
            o.status::TEXT AS status,
            o.created_at::TEXT AS created_at
        FROM orders o
        LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.tenant_id = :tenant_id
        ORDER BY o.created_at DESC
        LIMIT 5
    """)
    rows = (await db.exec(sql, {"tenant_id": tenant_id})).all()
    return [RecentOrderItem(**r._mapping) for r in rows]


@router.get("/admin/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    kpi_future = _kpi_query(db, tenant_id)
    fulfillment_future = _fulfillment_query(db, tenant_id)
    low_stock_future = _low_stock_query(db, tenant_id)
    recent_orders_future = _recent_orders_query(db, tenant_id)

    kpi, fulfillment, low_stock, recent_orders = await asyncio.gather(
        kpi_future, fulfillment_future, low_stock_future, recent_orders_future,
    )

    return DashboardSummaryResponse(
        **kpi,
        fulfillment=fulfillment,
        low_stock=low_stock,
        recent_orders=recent_orders,
    )
```

- [ ] **Step 3: Register router in `main.py`**

Add import:

```python
from src.routes.admin import router as admin_router  # noqa: E402
```

Add registration (after orders_router):

```python
app.include_router(admin_router, prefix="/api/v1")
```

- [ ] **Step 4: Write tests**

Create `services/backend-api/tests/test_dashboard.py`:

```python
import pytest
from uuid import uuid4
from httpx import AsyncClient, ASGITransport
from src.main import app
from src.database import async_engine
from src.orm.base import BaseModel


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)


@pytest.fixture
def tenant_id():
    return uuid4()


@pytest.fixture
async def client(tenant_id):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(tenant_id)
        yield ac


@pytest.mark.asyncio
async def test_dashboard_empty(client):
    response = await client.get("/api/v1/admin/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["revenue_mtd"] == 0
    assert data["orders_total"] == 0
    assert data["aov"] == 0
    assert data["fulfillment"]["unfulfilled"] == 0
    assert data["low_stock"] == []
    assert data["recent_orders"] == []
```

- [ ] **Step 5: Run tests**

```bash
cd services/backend-api
APP_ENV=test pytest tests/test_dashboard.py -x -v
```

Expected: Test passes.

- [ ] **Step 6: Update schemas/**init**.py**

```python
from src.orm.schemas.dashboard import DashboardSummaryResponse  # noqa: F401
```

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/routes/admin.py services/backend-api/src/orm/schemas/dashboard.py services/backend-api/src/orm/schemas/__init__.py services/backend-api/src/main.py services/backend-api/tests/test_dashboard.py
git commit -m "feat(api): add dashboard aggregator endpoint with 4 parallel queries"
```

---

### Task 7: Public Collections Endpoint

**Files:**

- Modify: `services/backend-api/src/routes/public.py`

- [ ] **Step 1: Add public collections endpoint to `routes/public.py`**

```python
@router.get("/collections/{tenant_slug}", response_model=list[CollectionResponse])
async def public_collections(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """List active collections for a tenant — public storefront browsing."""
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    stmt = (
        select(Collection)
        .options(selectinload(Collection.products))
        .where(
            Collection.tenant_id == tenant.tenant_id,
            Collection.is_active == True,
        )
        .order_by(Collection.sort_order, Collection.name)
    )
    collections = (await db.exec(stmt)).all()
    result = []
    for col in collections:
        result.append(CollectionResponse(
            **col.model_dump(),
            product_count=len(col.products),
        ))
    return result
```

Add imports at top of the file:

```python
from src.orm.models.collection import Collection
from src.orm.schemas.collection import CollectionResponse
```

- [ ] **Step 2: Run tests**

```bash
cd services/backend-api
APP_ENV=test pytest -x -v
```

Expected: All existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/routes/public.py
git commit -m "feat(api): add public collections endpoint with product_count"
```

---

### Task 8: TypeScript Types + Zod Schemas

**Files:**

- Modify: `packages/tenant-orm/src/types.ts`
- Modify: `packages/tenant-orm/src/schemas/tenant.ts`

- [ ] **Step 1: Add TypeScript types**

Open `packages/tenant-orm/src/types.ts`. Append:

```typescript
export interface Collection {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionCreate {
  name: string;
  slug: string;
  description?: string | null;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
  sort_order?: number;
}

export type CollectionUpdate = Partial<CollectionCreate> & {
  is_active?: boolean;
};

export interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_verified: boolean;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerDetail extends Customer {
  average_order_value: number;
  addresses: CustomerAddress[];
  orders: CustomerOrder[];
}

export interface CustomerAddress {
  id: string;
  address_type: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
}

export interface DashboardSummary {
  revenue_mtd: number;
  revenue_total: number;
  revenue_prev_mtd: number;
  orders_mtd: number;
  orders_total: number;
  orders_prev_mtd: number;
  aov: number;
  active_customers: number;
  active_customers_prev: number;
  fulfillment: {
    unfulfilled: number;
    processing: number;
    shipped: number;
    delivered: number;
  };
  low_stock: Array<{
    variant_id: string;
    product_name: string;
    sku: string;
    quantity: number;
    threshold: number;
  }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    customer_name: string | null;
    total: number;
    status: string;
    created_at: string;
  }>;
}
```

- [ ] **Step 2: Add Zod schemas**

Open `packages/tenant-orm/src/schemas/tenant.ts`. Append before `OrderSchema`:

```typescript
export const CollectionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  hero_image_url: z.string().nullable().optional(),
  hero_image_alt: z.string().nullable().optional(),
  sort_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  product_count: z.number().int().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CollectionCreateSchema = CollectionSchema.omit({
  id: true,
  tenant_id: true,
  is_active: true,
  product_count: true,
  created_at: true,
  updated_at: true,
});

export const CollectionUpdateSchema = CollectionCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_verified: z.boolean(),
  total_orders: z.number().int(),
  total_spent: z.number().int(),
  last_order_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DashboardSummarySchema = z.object({
  revenue_mtd: z.number().int(),
  revenue_total: z.number().int(),
  revenue_prev_mtd: z.number().int(),
  orders_mtd: z.number().int(),
  orders_total: z.number().int(),
  orders_prev_mtd: z.number().int(),
  aov: z.number().int(),
  active_customers: z.number().int(),
  active_customers_prev: z.number().int(),
  fulfillment: z.object({
    unfulfilled: z.number().int(),
    processing: z.number().int(),
    shipped: z.number().int(),
    delivered: z.number().int(),
  }),
  low_stock: z.array(
    z.object({
      variant_id: z.string(),
      product_name: z.string(),
      sku: z.string(),
      quantity: z.number().int(),
      threshold: z.number().int(),
    }),
  ),
  recent_orders: z.array(
    z.object({
      id: z.string(),
      order_number: z.string(),
      customer_name: z.string().nullable(),
      total: z.number().int(),
      status: z.string(),
      created_at: z.string(),
    }),
  ),
});
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/tenant-orm
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 4: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run packages/tenant-orm -v
```

Expected: All tenant-orm tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/tenant-orm/src/types.ts packages/tenant-orm/src/schemas/tenant.ts
git commit -m "feat(types): add Collection, Customer, DashboardSummary types and Zod schemas"
```

---

### Task 9: Admin API Client Extensions + Service Hooks

**Files:**

- Modify: `apps/admin/src/lib/api/client.ts`
- Create: `apps/admin/src/features/customers/api/customers-service.ts`
- Create: `apps/admin/src/features/customers/hooks/use-customers.ts`
- Create: `apps/admin/src/features/dashboard/hooks/use-dashboard.ts`
- Create: `apps/admin/src/features/collections/api/collections-service.ts`
- Create: `apps/admin/src/features/collections/hooks/use-collections.ts`

- [ ] **Step 1: Extend API client**

Open `apps/admin/src/lib/api/client.ts`. Append to the `api` object:

```typescript
export const api = {
  products: {
    /* existing */
  },
  customers: {
    list(params?: Record<string, string>, options?: RequestOptions) {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      return request<{
        data: any[];
        total: number;
        page: number;
        per_page: number;
      }>(`/customers/${query}`, options);
    },
    get(id: string, options?: RequestOptions) {
      return request<any>(`/customers/${id}`, options);
    },
  },
  collections: {
    list(params?: Record<string, string>, options?: RequestOptions) {
      const query = params ? "?" + new URLSearchParams(params).toString() : "";
      return request<any[]>(`/collections/${query}`, options);
    },
    create(data: any, options?: RequestOptions) {
      return request<any>("/collections/", {
        method: "POST",
        body: JSON.stringify(data),
        ...options,
      });
    },
    update(id: string, data: any, options?: RequestOptions) {
      return request<any>(`/collections/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        ...options,
      });
    },
    delete(id: string, options?: RequestOptions) {
      return request<{ status: string }>(`/collections/${id}`, {
        method: "DELETE",
        ...options,
      });
    },
    products(id: string, options?: RequestOptions) {
      return request<any[]>(`/collections/${id}/products`, options);
    },
    addProducts(id: string, productIds: string[], options?: RequestOptions) {
      return request<any>(`/collections/${id}/products`, {
        method: "POST",
        body: JSON.stringify({ product_ids: productIds }),
        ...options,
      });
    },
    removeProduct(
      collectionId: string,
      productId: string,
      options?: RequestOptions,
    ) {
      return request<any>(
        `/collections/${collectionId}/products/${productId}`,
        { method: "DELETE", ...options },
      );
    },
  },
  dashboard: {
    summary(options?: RequestOptions) {
      return request<any>("/admin/dashboard/summary", options);
    },
  },
};
```

- [ ] **Step 2: Create customers service**

`apps/admin/src/features/customers/api/customers-service.ts`:

```typescript
import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  return sessionStorage.getItem("admin_selected_tenant");
}

export async function fetchCustomers(params?: Record<string, string>) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.customers.list(params, { tenantId });
}

export async function fetchCustomer(id: string) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.customers.get(id, { tenantId });
}
```

- [ ] **Step 3: Create customers hooks**

`apps/admin/src/features/customers/hooks/use-customers.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchCustomers, fetchCustomer } from "../api/customers-service";

export function useCustomers(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => fetchCustomers(params),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
    enabled: !!id,
  });
}
```

- [ ] **Step 4: Create dashboard hook**

`apps/admin/src/features/dashboard/hooks/use-dashboard.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  return sessionStorage.getItem("admin_selected_tenant");
}

export function useDashboard() {
  const tenantId = getTenantId();
  return useQuery({
    queryKey: ["dashboard", tenantId],
    queryFn: () => api.dashboard.summary({ tenantId: tenantId ?? undefined }),
    enabled: !!tenantId,
  });
}
```

- [ ] **Step 5: Create collections service + hooks**

`apps/admin/src/features/collections/api/collections-service.ts`:

```typescript
import { api } from "@/lib/api/client";

function getTenantId(): string | null {
  return sessionStorage.getItem("admin_selected_tenant");
}

export async function fetchCollections(includeInactive?: boolean) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  const params = includeInactive ? "?include_inactive=true" : "";
  return api.collections.list(params, { tenantId });
}

export async function createCollection(data: any) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.create(data, { tenantId });
}

export async function updateCollection(id: string, data: any) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.update(id, data, { tenantId });
}

export async function deleteCollection(id: string) {
  const tenantId = getTenantId();
  if (!tenantId) throw new Error("No tenant selected");
  return api.collections.delete(id, { tenantId });
}
```

`apps/admin/src/features/collections/hooks/use-collections.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCollections,
  createCollection,
  updateCollection,
  deleteCollection,
} from "../api/collections-service";

export function useCollections(includeInactive?: boolean) {
  return useQuery({
    queryKey: ["collections", { includeInactive }],
    queryFn: () => fetchCollections(includeInactive),
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCollection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      updateCollection(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCollection,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collections"] }),
  });
}
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run apps/admin -v
```

Expected: All admin tests pass (should include existing product-form tests).

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/lib/api/client.ts apps/admin/src/features/
git commit -m "feat(admin): add API client, services, and hooks for customers, dashboard, collections"
```

---

### Task 10: Dashboard Page (UI)

**Files:**

- Modify: `apps/admin/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Rewrite the dashboard page**

```tsx
"use client";

import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Badge } from "@repo/ui/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

function StatCard({
  label,
  value,
  prev,
  format,
}: {
  label: string;
  value: number;
  prev: number;
  format: (n: number) => string;
}) {
  const delta = prev > 0 ? ((value - prev) / prev) * 100 : 0;
  const arrow = delta >= 0 ? "↑" : "↓";
  const color = delta >= 0 ? "text-green-600" : "text-red-600";
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-2xl">{format(value)}</CardTitle>
        <p className={`text-xs font-mono ${color}`}>
          {arrow} {Math.abs(delta).toFixed(1)}% vs previous period
        </p>
      </CardHeader>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  unfulfilled: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load dashboard"
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28 mt-2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header + Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => refetch()}
          className="text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Big Four KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Revenue (MTD)"
          value={data.revenue_mtd}
          prev={data.revenue_prev_mtd}
          format={formatPence}
        />
        <StatCard
          label="Orders (MTD)"
          value={data.orders_mtd}
          prev={data.orders_prev_mtd}
          format={(n) => n.toString()}
        />
        <StatCard label="AOV" value={data.aov} prev={0} format={formatPence} />
        <StatCard
          label="Active Customers"
          value={data.active_customers}
          prev={data.active_customers_prev}
          format={(n) => n.toString()}
        />
      </div>

      {/* Fulfillment Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Fulfillment Pipeline</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4 flex gap-3">
          {Object.entries(data.fulfillment).map(([key, count]) => (
            <Badge key={key} className={statusColors[key] ?? ""}>
              {key}: {count}
            </Badge>
          ))}
        </div>
      </Card>

      {/* Low Stock Alerts */}
      {data.low_stock.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Low Stock Alerts</CardTitle>
          </CardHeader>
          <div className="px-6 pb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-2">Product</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {data.low_stock.map((item) => (
                  <tr key={item.variant_id} className="border-t">
                    <td className="py-1.5">{item.product_name}</td>
                    <td className="py-1.5 font-mono text-muted-foreground">
                      {item.sku}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono ${item.quantity <= 0 ? "text-red-600 font-bold" : ""}`}
                    >
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Orders</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2 text-right">Total</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.map((order) => (
                <tr key={order.id} className="border-t">
                  <td className="py-1.5">{order.order_number}</td>
                  <td className="py-1.5">{order.customer_name || "—"}</td>
                  <td className="py-1.5 text-right font-mono">
                    {formatPence(order.total)}
                  </td>
                  <td className="py-1.5">
                    <Badge className={statusColors[order.status] ?? ""}>
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {data.recent_orders.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-4 text-center text-muted-foreground"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run apps/admin -v
```

Expected: All admin tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/(app)/dashboard/page.tsx
git commit -m "feat(admin): rewrite dashboard with real KPI metrics and fulfillment pipeline"
```

---

### Task 11: Customer Directory Page

**Files:**

- Create: `apps/admin/src/app/(app)/customers/page.tsx`
- Create: `apps/admin/src/components/customers/customers-table.tsx`

- [ ] **Step 1: Create customers directory page**

`apps/admin/src/app/(app)/customers/page.tsx`:

```tsx
import { CustomersTable } from "@/components/customers/customers-table";

export default function CustomersPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-muted-foreground">View and manage customers</p>
      </div>
      <CustomersTable />
    </div>
  );
}
```

- [ ] **Step 2: Create customers table component**

`apps/admin/src/components/customers/customers-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useCustomers } from "@/features/customers/hooks/use-customers";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Input } from "@repo/ui/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRouter } from "next/navigation";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

export function CustomersTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const router = useRouter();

  const params: Record<string, string> = {};
  if (search) params.search = search;
  params.page = String(page);
  params.per_page = "20";

  const { data, isLoading, error, refetch } = useCustomers(params);

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load customers"
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3 text-right">LTV</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20 ml-auto" />
                  </td>
                </tr>
              ))}
            {data?.data.map((customer: any) => (
              <tr
                key={customer.id}
                className="border-b last:border-0 cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium">
                    {[customer.first_name, customer.last_name]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {customer.email}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm text-muted-foreground">
                  {customer.created_at
                    ? new Date(customer.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-sm">{customer.total_orders}</td>
                <td className="px-4 py-2.5 text-sm text-right font-mono font-medium">
                  {formatPence(customer.total_spent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && (!data || data.data.length === 0) && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No customers yet
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.total > data.per_page && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Showing {(data.page - 1) * data.per_page + 1}–
            {Math.min(data.page * data.per_page, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <button
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={data.page * data.per_page >= data.total}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run apps/admin -v
```

Expected: All admin tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/(app)/customers/page.tsx apps/admin/src/components/customers/customers-table.tsx
git commit -m "feat(admin): add customer directory page with search and pagination"
```

---

### Task 12: Customer Detail Profile Page

**Files:**

- Create: `apps/admin/src/app/(app)/customers/[id]/page.tsx`
- Create: `apps/admin/src/components/customers/customer-profile.tsx`

- [ ] **Step 1: Create customer detail page**

`apps/admin/src/app/(app)/customers/[id]/page.tsx`:

```tsx
import { CustomerProfile } from "@/components/customers/customer-profile";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-6">
      <CustomerProfile customerId={id} />
    </div>
  );
}
```

- [ ] **Step 2: Create customer profile component**

`apps/admin/src/components/customers/customer-profile.tsx`:

```tsx
"use client";

import { useCustomer } from "@/features/customers/hooks/use-customers";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Card, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRouter } from "next/navigation";

function formatPence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function CustomerProfile({ customerId }: { customerId: string }) {
  const { data, isLoading, error, refetch } = useCustomer(customerId);
  const router = useRouter();

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load customer"
        onRetry={() => refetch()}
      />
    );
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
            <Skeleton className="h-4 w-24 mt-2" />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-16 w-full mt-2" />
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {[data.first_name, data.last_name].filter(Boolean).join(" ") || "—"}
          </CardTitle>
          <div className="mt-4 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{data.email}</p>
            </div>
            {data.phone && (
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{data.phone}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Customer since</span>
              <p className="font-medium">
                {data.created_at
                  ? new Date(data.created_at).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            {data.last_order_at && (
              <div>
                <span className="text-muted-foreground">Last order</span>
                <p className="font-medium">
                  {new Date(data.last_order_at).toLocaleDateString()}
                </p>
              </div>
            )}
            {data.addresses && data.addresses.length > 0 && (
              <div>
                <span className="text-muted-foreground">Shipping address</span>
                <p className="font-medium">
                  {data.addresses.find((a: any) => a.is_default)?.line1 ??
                    data.addresses[0].line1}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <span className="text-xs text-muted-foreground">Total Spent</span>
              <p className="text-lg font-mono font-bold">
                {formatPence(data.total_spent)}
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">
                Avg Order Value
              </span>
              <p className="text-lg font-mono font-bold">
                {formatPence(data.average_order_value)}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Right: Order Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Order History</CardTitle>
        </CardHeader>
        <div className="px-6 pb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2">Order</th>
                <th className="pb-2">Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((order: any) => (
                <tr
                  key={order.id}
                  className="border-t cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <td className="py-1.5 font-medium">{order.order_number}</td>
                  <td className="py-1.5 text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-1.5">
                    <Badge className={statusColors[order.status] ?? ""}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatPence(order.total)}
                  </td>
                </tr>
              ))}
              {data.orders.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run apps/admin -v
```

Expected: All admin tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/(app)/customers/\[id\]/ apps/admin/src/components/customers/customer-profile.tsx
git commit -m "feat(admin): add customer detail page with profile card and order ledger"
```

---

### Task 13: Sidebar Navigation — Add Customers Link

**Files:**

- Modify: `apps/admin/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Customers nav item**

Open `apps/admin/src/components/layout/sidebar.tsx`. In the Catalog section, add a Customers item after Categories and before Orders:

```typescript
      {
        label: "Customers",
        href: "/customers",
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run -v | tail -5
```

Expected: 131+ tests passing.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/layout/sidebar.tsx
git commit -m "feat(admin): add Customers link to sidebar navigation"
```

---

### Task 14: Admin Collections Page (CRUD Table + Modal)

**Files:**

- Create: `apps/admin/src/app/(app)/collections/page.tsx`
- Create: `apps/admin/src/components/collections/collections-table.tsx`
- Create: `apps/admin/src/components/collections/collection-modal.tsx`

Follow the exact pattern from the Categories implementation (Task 5 of the previous category-filtering branch). The structure mirrors `categories-table.tsx` and `category-modal.tsx`.

- [ ] **Step 1: Create collections page**

`apps/admin/src/app/(app)/collections/page.tsx`:

```tsx
import { CollectionsTable } from "@/components/collections/collections-table";

export default function CollectionsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Collections</h1>
        <p className="text-muted-foreground">Manage product collections</p>
      </div>
      <CollectionsTable />
    </div>
  );
}
```

- [ ] **Step 2: Create collections table**

`apps/admin/src/components/collections/collections-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  useCollections,
  useDeleteCollection,
} from "@/features/collections/hooks/use-collections";
import { CollectionModal } from "./collection-modal";

export function CollectionsTable() {
  const { data: collections, isLoading, refetch } = useCollections(true);
  const deleteMutation = useDeleteCollection();
  const [editing, setEditing] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string, productCount: number) {
    if (productCount > 0) {
      const ok = window.confirm(
        `This collection has ${productCount} product(s). Deleting will hide it. Continue?`,
      );
      if (!ok) return;
    }
    setDeleting(id);
    await deleteMutation.mutateAsync(id);
    setDeleting(null);
    refetch();
  }

  return (
    <>
      <button
        onClick={() => {
          setEditing(null);
          setShowModal(true);
        }}
        className="mb-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Add Collection
      </button>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-sm font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {collections?.map((col: any) => (
              <tr key={col.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-sm font-medium">{col.name}</td>
                <td className="px-4 py-2 text-sm text-muted-foreground font-mono">
                  {col.slug}
                </td>
                <td className="px-4 py-2 text-sm">
                  {col.is_active ? "ACTIVE" : "INACTIVE"}
                </td>
                <td className="px-4 py-2 text-sm text-right">
                  {col.product_count} items
                </td>
                <td className="px-4 py-2 text-sm text-right space-x-2">
                  <button
                    onClick={() => {
                      setEditing(col);
                      setShowModal(true);
                    }}
                    className="text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(col.id, col.product_count)}
                    disabled={deleting === col.id}
                    className="text-destructive hover:underline disabled:opacity-50"
                  >
                    {deleting === col.id ? "..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!collections || collections.length === 0) && !isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No collections yet.
          </div>
        )}
      </div>

      {showModal && (
        <CollectionModal
          collection={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            refetch();
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Create collection modal**

`apps/admin/src/components/collections/collection-modal.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface CollectionModalProps {
  collection: {
    id?: string;
    name?: string;
    slug?: string;
    description?: string | null;
    hero_image_url?: string | null;
    hero_image_alt?: string | null;
    sort_order?: number;
    is_active?: boolean;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function CollectionModal({
  collection,
  onClose,
  onSaved,
}: CollectionModalProps) {
  const [name, setName] = useState(collection?.name ?? "");
  const [slug, setSlug] = useState(collection?.slug ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(
    collection?.hero_image_url ?? "",
  );
  const [heroImageAlt, setHeroImageAlt] = useState(
    collection?.hero_image_alt ?? "",
  );
  const [sortOrder, setSortOrder] = useState(collection?.sort_order ?? 0);
  const [isActive, setIsActive] = useState(collection?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const method = collection?.id ? "PUT" : "POST";
    const url = collection?.id
      ? `/api/v1/collections/${collection.id}`
      : "/api/v1/collections/";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description,
          hero_image_url: heroImageUrl,
          hero_image_alt: heroImageAlt,
          sort_order: sortOrder,
          is_active: isActive,
        }),
      });

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ detail: "Failed to save" }));
        setError(err.detail ?? "Failed to save");
        return;
      }
      onSaved();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-bold mb-4">
          {collection?.id ? "Edit Collection" : "Add Collection"}
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Hero Image URL</label>
              <input
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Image Alt Text</label>
              <input
                value={heroImageAlt}
                onChange={(e) => setHeroImageAlt(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add Collections to sidebar navigation**

Add a Collections link in the Catalog section (between Products and Categories or adjacent). Use a grid/stack icon SVG similar to the other nav items.

- [ ] **Step 5: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run -v | tail -5
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/(app)/collections/ apps/admin/src/components/collections/ apps/admin/src/components/layout/sidebar.tsx
git commit -m "feat(admin): add collections management page with CRUD table and modal"
```

---

### Task 15: Product Form — Collection Multi-Select

**Files:**

- Modify: `apps/admin/src/components/products/product-form.tsx`

- [ ] **Step 1: Add collection multi-select to product form**

Open `apps/admin/src/components/products/product-form.tsx`. Import:

```typescript
import { useCollections } from "@/features/collections/hooks/use-collections";
```

Add a multi-select field after the category select:

```tsx
{
  /* Collections Multi-Select */
}
<div className="space-y-2">
  <label className="text-sm font-medium">Collections</label>
  <div className="max-h-40 overflow-y-auto rounded-lg border p-2 space-y-1">
    {collections.map((col: any) => (
      <label key={col.id} className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          value={col.id}
          checked={selectedCollections.includes(col.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedCollections([...selectedCollections, col.id]);
            } else {
              setSelectedCollections(
                selectedCollections.filter((id: string) => id !== col.id),
              );
            }
          }}
          className="h-4 w-4 rounded border-gray-300"
        />
        {col.name}
      </label>
    ))}
  </div>
</div>;
```

Add state:

```typescript
const { data: collections } = useCollections(false);
const [selectedCollections, setSelectedCollections] = useState<string[]>(
  initialData?.collection_ids ?? [],
);
```

On submit, include `collection_ids: selectedCollections` in the payload.

- [ ] **Step 2: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run apps/admin -v
```

Expected: All admin tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/products/product-form.tsx
git commit -m "feat(admin): add collection multi-select to product form"
```

---

### Task 16: Storefront Collection Routes

**Files:**

- Create: `apps/storefront/src/app/[tenant]/collections/page.tsx`
- Create: `apps/storefront/src/app/[tenant]/collections/[slug]/page.tsx`
- Modify: `apps/storefront/src/lib/api.ts`
- Modify: `apps/storefront/src/components/storefront/product-grid.tsx`

- [ ] **Step 1: Add fetchCollections + collection param to api.ts**

```typescript
export async function fetchCollections(
  tenantSlug: string,
): Promise<Collection[]> {
  const res = await fetch(
    `${API_BASE}/api/v1/public/collections/${tenantSlug}`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return [];
  return res.json();
}
```

Update `fetchProducts` to accept optional `collectionSlug`:

```typescript
export async function fetchProducts(
  tenantSlug: string,
  options?: { category?: string; collection?: string },
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  // collection filter is a separate parameter — backend needs a collection query param
  if (options?.collection) params.set("collection", options.collection);
  // ...rest
}
```

- [ ] **Step 2: Create collections list page**

`apps/storefront/src/app/[tenant]/collections/page.tsx`:

```tsx
import { fetchCollections } from "@/lib/api";
import Link from "next/link";

export default async function CollectionsPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const collections = await fetchCollections(tenant);

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Collections</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((col) => (
          <Link
            key={col.id}
            href={`/${tenant}/collections/${col.slug}`}
            className="relative aspect-[3/2] rounded-lg overflow-hidden bg-black group"
          >
            {col.hero_image_url && (
              <img
                src={col.hero_image_url}
                alt={col.hero_image_alt || col.name}
                className="object-cover w-full h-full opacity-60 group-hover:opacity-80 transition-opacity"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <h2 className="text-white text-2xl font-bold tracking-wide">
                {col.name}
              </h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create collection detail page**

`apps/storefront/src/app/[tenant]/collections/[slug]/page.tsx`:

- Accepts `collectionSlug` param
- Uses `fetchProducts(tenant, { collection: slug })` to get products in collection
- Renders a hero banner with collection `hero_image_url` + name
- Below hero: `ProductGrid` with `collectionSlug={slug}`

- [ ] **Step 4: Update ProductGrid to accept collectionSlug**

Pass through to fetchProducts as with categorySlug.

- [ ] **Step 5: Run tests**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify
pnpm vitest run -v | tail -5
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/app/[tenant]/collections/ apps/storefront/src/lib/api.ts apps/storefront/src/components/storefront/product-grid.tsx
git commit -m "feat(storefront): add collection browsing routes and hero cards"
```
