import uuid

from fastapi.testclient import TestClient
import pytest
from sqlmodel import delete

from src.database import async_engine
from src.main import app
from src.orm.models.category import Category

TENANT_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(autouse=True)
async def clean_categories():
    from sqlmodel.ext.asyncio.session import AsyncSession
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM stock_transfer_items"))
        await db.exec(text("DELETE FROM stock_transfers"))
        await db.exec(text("DELETE FROM order_fulfillment_links"))
        await db.exec(text("DELETE FROM purchase_order_items"))
        await db.exec(text("DELETE FROM cart_items"))
        await db.exec(text("DELETE FROM inventory"))
        await db.exec(text("DELETE FROM product_collections"))
        await db.exec(text("DELETE FROM customer_addresses"))
        await db.exec(text("DELETE FROM product_images"))
        await db.exec(delete(Variant))
        await db.exec(delete(Product))
        stmt = delete(Category)
        await db.exec(stmt)
        await db.commit()


from sqlalchemy import text

from src.orm.models.product import Product, Variant


@pytest.fixture
def client():
    return TestClient(app)


def _slug(prefix: str = "cat") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_create_category(client: TestClient):
    slug = _slug()
    response = client.post(
        "/api/v1/categories/",
        json={"name": "Test Category", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Category"
    assert data["slug"] == slug
    assert data["is_active"] is True
    assert data["product_count"] == 0


def test_list_categories(client: TestClient):
    slug = _slug()
    client.post(
        "/api/v1/categories/",
        json={"name": "List Test", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    response = client.get("/api/v1/categories/", headers={"X-Tenant-ID": TENANT_ID})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_delete_category(client: TestClient):
    slug = _slug()
    cat_resp = client.post(
        "/api/v1/categories/",
        json={"name": "Delete Me", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert cat_resp.status_code == 200
    cat_id = cat_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/categories/{cat_id}", headers={"X-Tenant-ID": TENANT_ID})
    assert del_resp.status_code == 200
    assert del_resp.json() == {"ok": True}


def test_update_category(client: TestClient):
    slug = _slug()
    cat_resp = client.post(
        "/api/v1/categories/",
        json={"name": "Update Me", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert cat_resp.status_code == 200
    cat_id = cat_resp.json()["id"]

    upd_resp = client.put(
        f"/api/v1/categories/{cat_id}",
        json={"name": "Updated"},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["name"] == "Updated"


def test_category_not_found(client: TestClient):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.delete(f"/api/v1/categories/{fake_id}", headers={"X-Tenant-ID": TENANT_ID})
    assert response.status_code == 404
    assert response.json()["detail"] == "Category not found"
