"""Integration tests for the Orders API."""

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
    defaults = dict(tenant_id=TENANT_A, email=f"{uuid4().hex[:8]}@test.com")
    defaults.update(kw)
    c = Customer(**defaults)
    db.add(c)
    await db.flush()
    return c


async def _order(db: AsyncSession, customer: Customer, **kw) -> Order:
    defaults = dict(
        tenant_id=TENANT_A,
        customer_id=customer.id,
        order_number=uuid4().hex[:12],
        status="pending",
        subtotal=1000,
        total=1000,
    )
    defaults.update(kw)
    o = Order(**defaults)
    db.add(o)
    await db.flush()
    return o


# ─── Empty / Edge Cases ───────────────────────────────────────────────


class TestListOrders:
    async def test_list_empty(self, client_a: AsyncClient):
        resp = await client_a.get("/api/v1/orders/")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0

    async def test_list_with_orders(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            await _order(db, c, order_number="SO-001")
            await _order(db, c, order_number="SO-002", status="paid")
            await db.commit()

        resp = await client_a.get("/api/v1/orders/")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 2
        assert body["pagination"]["total"] == 2

    async def test_filter_by_status(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            await _order(db, c, order_number="SO-001", status="pending")
            await _order(db, c, order_number="SO-002", status="paid")
            await _order(db, c, order_number="SO-003", status="cancelled")
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?status=paid")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["order_number"] == "SO-002"

    async def test_filter_by_search(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db, email="alice@example.com")
            await _order(db, c, order_number="SO-ALPHA")
            await _order(db, c, order_number="SO-BETA")
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?search=ALPHA")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["order_number"] == "SO-ALPHA"

    async def test_search_by_customer_email(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db, email="bob@example.com")
            await _order(db, c, order_number="SO-BOB")
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?search=bob@example.com")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1

    async def test_sort_by_total_asc(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            await _order(db, c, order_number="SO-001", total=5000)
            await _order(db, c, order_number="SO-002", total=1000)
            await _order(db, c, order_number="SO-003", total=3000)
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?sort_by=total&sort_order=asc")
        assert resp.status_code == 200
        body = resp.json()
        totals = [o["total"] for o in body["data"]]
        assert totals == [1000, 3000, 5000]

    async def test_sort_by_total_desc(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            await _order(db, c, order_number="SO-001", total=5000)
            await _order(db, c, order_number="SO-002", total=1000)
            await _order(db, c, order_number="SO-003", total=3000)
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?sort_by=total&sort_order=desc")
        assert resp.status_code == 200
        body = resp.json()
        totals = [o["total"] for o in body["data"]]
        assert totals == [5000, 3000, 1000]

    async def test_pagination(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            for i in range(5):
                await _order(db, c, order_number=f"SO-{i:03d}", total=i * 1000)
            await db.commit()

        resp = await client_a.get("/api/v1/orders/?page=1&page_size=2")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 2
        assert body["pagination"]["total"] == 5
        assert body["pagination"]["total_pages"] == 3

    async def test_no_tenant_header_returns_401(self):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/api/v1/orders/")
        assert resp.status_code == 401

    async def test_tenant_isolation(self, client_a: AsyncClient, client_b: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            await _order(db, c, order_number="SO-A-001")
            # Tenant B order
            cb = Customer(tenant_id=TENANT_B, email="b@b.com")
            db.add(cb)
            await db.flush()
            ob = Order(
                tenant_id=TENANT_B,
                customer_id=cb.id,
                order_number="SO-B-001",
                status="pending",
                subtotal=2000,
                total=2000,
            )
            db.add(ob)
            await db.commit()

        resp_a = await client_a.get("/api/v1/orders/")
        resp_b = await client_b.get("/api/v1/orders/")
        assert len(resp_a.json()["data"]) == 1
        assert resp_a.json()["data"][0]["order_number"] == "SO-A-001"
        assert len(resp_b.json()["data"]) == 1
        assert resp_b.json()["data"][0]["order_number"] == "SO-B-001"


class TestGetOrder:
    async def test_get_existing_order(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-GET")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.get(f"/api/v1/orders/{order_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["order_number"] == "SO-GET"
        assert body["total"] == 1000

    async def test_get_nonexistent_order(self, client_a: AsyncClient):
        resp = await client_a.get(f"/api/v1/orders/{uuid4()}")
        assert resp.status_code == 404

    async def test_get_other_tenant_order_returns_404(self, client_a: AsyncClient, client_b: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c)
            order_id = str(o.id)
            await db.commit()

        resp = await client_b.get(f"/api/v1/orders/{order_id}")
        assert resp.status_code == 404


class TestCreateOrder:
    CREATE_PAYLOAD = {
        "items": [{"product_name": "Test Item", "sku": "TST-001", "quantity": 2, "unit_price": 500, "total_price": 1000}],
        "subtotal": 1000,
        "total": 1000,
    }

    async def test_create_order(self, client_a: AsyncClient):
        resp = await client_a.post("/api/v1/orders/", json=self.CREATE_PAYLOAD)
        assert resp.status_code == 201
        body = resp.json()
        assert body["order_number"].startswith("SO-")
        assert body["status"] == "pending"
        assert body["total"] == 1000
        assert len(body["items"]) == 1

    async def test_create_order_with_custom_number(self, client_a: AsyncClient):
        payload = {**self.CREATE_PAYLOAD, "order_number": "SO-CUSTOM"}
        resp = await client_a.post("/api/v1/orders/", json=payload)
        assert resp.status_code == 201
        assert resp.json()["order_number"] == "SO-CUSTOM"


class TestUpdateOrder:
    async def test_update_status_valid_transition(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-UPDATE")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.put(f"/api/v1/orders/{order_id}", json={"status": "confirmed"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmed"

    async def test_update_status_invalid_transition(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-INVALID")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.put(f"/api/v1/orders/{order_id}", json={"status": "delivered"})
        assert resp.status_code == 422
        assert "Cannot transition" in resp.json()["detail"]

    async def test_update_status_from_cancelled_raises(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-CANC", status="cancelled")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.put(f"/api/v1/orders/{order_id}", json={"status": "pending"})
        assert resp.status_code == 422

    async def test_update_notes(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-NOTES")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.put(f"/api/v1/orders/{order_id}", json={"notes": "Updated notes"})
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Updated notes"

    async def test_patch_works_like_put(self, client_a: AsyncClient):
        async with AsyncSession(async_engine) as db:
            c = await _customer(db)
            o = await _order(db, c, order_number="SO-PATCH")
            order_id = str(o.id)
            await db.commit()

        resp = await client_a.patch(f"/api/v1/orders/{order_id}", json={"status": "confirmed"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "confirmed"

    async def test_update_nonexistent_order(self, client_a: AsyncClient):
        resp = await client_a.put(f"/api/v1/orders/{uuid4()}", json={"status": "confirmed"})
        assert resp.status_code == 404
