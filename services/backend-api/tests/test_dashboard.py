from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Customer, Order
from src.orm.models.product import Product, Variant


TENANT_A = "00000000-0000-0000-0000-000000000001"
TENANT_B = "00000000-0000-0000-0000-000000000002"


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM order_fulfillment_links"))
        await db.exec(text("DELETE FROM purchase_order_items"))
        await db.exec(text("DELETE FROM cart_items"))
        await db.exec(text("DELETE FROM product_collections"))
        await db.exec(text("DELETE FROM inventory"))
        await db.exec(delete(Variant))
        await db.exec(delete(Product))
        await db.exec(delete(Order))
        await db.exec(delete(Customer))
        await db.commit()
    yield


@pytest.fixture
async def client_a():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = TENANT_A
        yield ac


@pytest.fixture
async def client_b():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = TENANT_B
        yield ac


async def _customer(db: AsyncSession, **kw) -> Customer:
    c = Customer(
        tenant_id=TENANT_A, email=f"{uuid4().hex[:8]}@test.com", **kw
    )
    db.add(c)
    await db.flush()
    return c


async def _product(db: AsyncSession, **kw) -> Product:
    defaults = dict(tenant_id=TENANT_A, name="P", slug=uuid4().hex[:8])
    defaults.update(kw)
    p = Product(**defaults)
    db.add(p)
    await db.flush()
    return p


async def _variant(db: AsyncSession, product: Product, **kw) -> Variant:
    defaults = dict(tenant_id=TENANT_A, product_id=product.id, sku=uuid4().hex[:8], inventory_quantity=10, price=1000)
    defaults.update(kw)
    v = Variant(**defaults)
    db.add(v)
    await db.flush()
    return v


async def _order(db: AsyncSession, customer: Customer, **kw) -> Order:
    defaults = dict(tenant_id=TENANT_A, customer_id=customer.id, order_number=uuid4().hex[:12], status="pending", subtotal=1000, total=1000)
    defaults.update(kw)
    o = Order(**defaults)
    db.add(o)
    await db.flush()
    return o


# ─── Empty / Edge Cases ───────────────────────────────────────────────


async def test_empty_tenant_returns_defaults(client_a: AsyncClient):
    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    assert resp.status_code == 200
    d = resp.json()
    assert d["revenue_mtd"] == 0
    assert d["revenue_total"] == 0
    assert d["revenue_prev_mtd"] == 0
    assert d["orders_mtd"] == 0
    assert d["orders_total"] == 0
    assert d["orders_prev_mtd"] == 0
    assert d["aov"] == 0
    assert d["active_customers"] == 0
    assert d["active_customers_prev"] == 0
    assert d["fulfillment"] == {"unfulfilled": 0, "processing": 0, "shipped": 0, "delivered": 0}
    assert d["low_stock"] == []
    assert d["recent_orders"] == []


async def test_no_tenant_header_returns_401():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/api/v1/admin/dashboard/summary")
    assert resp.status_code == 401


# ─── KPI Values ───────────────────────────────────────────────────────


async def test_kpi_values(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        c1 = await _customer(db, first_name="Alice")
        c2 = await _customer(db, first_name="Bob")
        for customer in [c1, c1, c2]:
            await _order(db, customer, total=2000, subtotal=2000)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    assert resp.status_code == 200
    d = resp.json()
    assert d["revenue_mtd"] == 6000
    assert d["orders_mtd"] == 3
    assert d["active_customers"] == 2
    assert d["aov"] == 2000


async def test_aov_zero_when_no_orders_mtd(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        await _customer(db)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    assert resp.json()["aov"] == 0


# ─── Previous Period ─────────────────────────────────────────────────


async def test_previous_period_counts(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        c = await _customer(db)
        # MTD orders
        await _order(db, c, total=3000, subtotal=3000)
        # prev-MTD orders — created_at in previous month
        from datetime import datetime, timezone, timedelta
        last_month = datetime.now(timezone.utc) - timedelta(days=35)
        await _order(db, c, total=2000, subtotal=2000, created_at=last_month)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    d = resp.json()
    assert d["revenue_mtd"] == 3000
    assert d["orders_mtd"] == 1
    assert d["revenue_prev_mtd"] == 2000
    assert d["orders_prev_mtd"] == 1
    assert d["revenue_total"] == 5000
    assert d["orders_total"] == 2


# ─── Fulfillment Pipeline ─────────────────────────────────────────────


async def test_fulfillment_counts(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        c = await _customer(db)
        statuses = {"pending": 2, "processing": 1, "shipped": 3, "delivered": 4, "cancelled": 2}
        for status, count in statuses.items():
            for _ in range(count):
                await _order(db, c, status=status)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    f = resp.json()["fulfillment"]
    assert f["unfulfilled"] == 2  # only pending
    assert f["processing"] == 1
    assert f["shipped"] == 3
    assert f["delivered"] == 4
    # cancelled orders should NOT appear in fulfillment pipeline


# ─── Low Stock ────────────────────────────────────────────────────────


async def test_low_stock_returns_variants_below_threshold(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        p = await _product(db, name="Low Item")
        await _variant(db, p, sku="LOW-SKU", inventory_quantity=3)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    ls = resp.json()["low_stock"]
    assert len(ls) == 1
    assert ls[0]["sku"] == "LOW-SKU"
    assert ls[0]["quantity"] == 3
    assert ls[0]["product_name"] == "Low Item"
    assert ls[0]["threshold"] == 5


async def test_no_low_stock_when_above_threshold(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        p = await _product(db)
        await _variant(db, p, inventory_quantity=10)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    assert resp.json()["low_stock"] == []


# ─── Recent Orders ────────────────────────────────────────────────────


async def test_recent_orders_returns_last_5(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        c = await _customer(db, first_name="John", last_name="Doe")
        for i in range(7):
            await _order(db, c, order_number=f"ORD-{i:04d}")
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    orders = resp.json()["recent_orders"]
    assert len(orders) == 5
    assert orders[0]["customer_name"] == "John Doe"


async def test_recent_orders_null_customer_name(client_a: AsyncClient):
    async with AsyncSession(async_engine) as db:
        c = await _customer(db, first_name=None, last_name=None)
        await _order(db, c)
        await db.commit()

    resp = await client_a.get("/api/v1/admin/dashboard/summary")
    orders = resp.json()["recent_orders"]
    assert len(orders) == 1
    assert orders[0]["customer_name"] is None


# ─── Tenant Isolation ─────────────────────────────────────────────────


async def test_tenant_isolation(client_a: AsyncClient, client_b: AsyncClient):
    async with AsyncSession(async_engine) as db:
        ca = await _customer(db, first_name="Alice")
        await _order(db, ca, total=5000, subtotal=5000)
        # Tenant B customer
        cb = Customer(
            tenant_id=TENANT_B, email="b@b.com", first_name="Bob"
        )
        db.add(cb)
        await db.flush()
        ob = Order(
            tenant_id=TENANT_B,
            customer_id=cb.id,
            order_number=uuid4().hex[:12],
            status="delivered",
            subtotal=9999,
            total=9999,
        )
        db.add(ob)
        await db.commit()

    da = (await client_a.get("/api/v1/admin/dashboard/summary")).json()
    db_resp = (await client_b.get("/api/v1/admin/dashboard/summary")).json()

    # Tenant A sees their data
    assert da["revenue_mtd"] == 5000
    assert da["orders_mtd"] == 1
    # Tenant B sees theirs, not A's
    assert db_resp["revenue_mtd"] == 9999
    assert db_resp["orders_mtd"] == 1
