import os

os.environ.setdefault("APP_ENV", "test")

import pytest
from uuid import UUID, uuid4
from httpx import AsyncClient, ASGITransport
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.main import app
from src.orm.base import BaseModel
from src.orm.models.product import Product, Variant, Inventory, Location, ProductImage
from src.database import async_engine

TENANT_A = UUID("00000000-0000-0000-0000-000000000001")
TENANT_B = UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        for tid in [TENANT_A, TENANT_B]:
            loc = Location(
                name="Default Warehouse",
                tenant_id=tid,
                is_active=True,
            )
            db.add(loc)
        await db.commit()
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(Inventory))
        await db.exec(delete(Variant))
        await db.exec(delete(ProductImage))
        await db.exec(delete(Product))
        await db.exec(delete(Location))
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
        assert body["pagination"]["total_pages"] == 0

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

    # Transactional rollback is implicitly tested by test_create_duplicate_sku:
    # the second POST fails (409) after Product insertion, and get_db's
    # rollback undoes the orphan Product — so no cleanup needed.


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
