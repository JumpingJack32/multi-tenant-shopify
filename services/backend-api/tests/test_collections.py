import uuid
from uuid import UUID

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlmodel import delete, Session

from src.database import async_engine
from src.main import app
from src.orm.models.collection import Collection, ProductCollection
from src.orm.models.product import Product

TENANT_ID = "00000000-0000-0000-0000-000000000001"


def _sync_engine():
    import os

    from src.config import settings

    db_url = os.environ.get("TEST_DATABASE_URL") or settings.database_url
    sync_url = db_url.replace("+asyncpg", "+psycopg")
    return create_engine(sync_url)


@pytest.fixture(autouse=True)
async def clean_collections():
    from sqlmodel.ext.asyncio.session import AsyncSession

    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM stock_transfer_items"))
        await db.exec(text("DELETE FROM stock_transfers"))
        await db.exec(text("DELETE FROM order_fulfillment_links"))
        await db.exec(text("DELETE FROM purchase_order_items"))
        await db.exec(text("DELETE FROM cart_items"))
        await db.exec(text("DELETE FROM inventory"))
        await db.exec(delete(Variant))
        stmt = delete(ProductCollection)
        await db.exec(stmt)
        stmt = delete(Collection)
        await db.exec(stmt)
        stmt = delete(Product)
        await db.exec(stmt)
        await db.commit()


from sqlalchemy import text

from src.orm.models.product import Variant


@pytest.fixture
def client():
    return TestClient(app)


def _slug(prefix: str = "col") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _create_product(slug: str) -> dict:
    engine = _sync_engine()
    with Session(engine) as db:
        product = Product(
            name="Test Product",
            slug=slug,
            tenant_id=UUID(TENANT_ID),
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return {
            "id": str(product.id),
            "name": product.name,
            "slug": product.slug,
        }


def test_create_collection(client: TestClient):
    slug = _slug()
    response = client.post(
        "/api/v1/collections/",
        json={"name": "Test Collection", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Collection"
    assert data["slug"] == slug
    assert data["is_active"] is True
    assert data["product_count"] == 0


def test_list_collections(client: TestClient):
    slug = _slug()
    client.post(
        "/api/v1/collections/",
        json={"name": "List Test", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    response = client.get("/api/v1/collections/", headers={"X-Tenant-ID": TENANT_ID})
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_list_collections_excludes_inactive(client: TestClient):
    slug = _slug()
    resp = client.post(
        "/api/v1/collections/",
        json={"name": "Inactive Collection", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = resp.json()["id"]
    client.delete(f"/api/v1/collections/{col_id}", headers={"X-Tenant-ID": TENANT_ID})

    response = client.get("/api/v1/collections/", headers={"X-Tenant-ID": TENANT_ID})
    ids = [c["id"] for c in response.json()]
    assert col_id not in ids


def test_list_collections_includes_inactive_with_flag(client: TestClient):
    slug = _slug()
    resp = client.post(
        "/api/v1/collections/",
        json={"name": "Inclusive Collection", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = resp.json()["id"]
    client.delete(f"/api/v1/collections/{col_id}", headers={"X-Tenant-ID": TENANT_ID})

    response = client.get(
        "/api/v1/collections/?include_inactive=true",
        headers={"X-Tenant-ID": TENANT_ID},
    )
    ids = [c["id"] for c in response.json()]
    assert col_id in ids


def test_update_collection(client: TestClient):
    slug = _slug()
    resp = client.post(
        "/api/v1/collections/",
        json={"name": "Update Me", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = resp.json()["id"]

    upd_resp = client.put(
        f"/api/v1/collections/{col_id}",
        json={"name": "Updated"},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["name"] == "Updated"


def test_soft_delete(client: TestClient):
    slug = _slug()
    resp = client.post(
        "/api/v1/collections/",
        json={"name": "Soft Delete", "slug": slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = resp.json()["id"]

    del_resp = client.delete(
        f"/api/v1/collections/{col_id}", headers={"X-Tenant-ID": TENANT_ID}
    )
    assert del_resp.status_code == 200
    assert del_resp.json() == {"status": "deactivated"}

    del_resp2 = client.delete(
        f"/api/v1/collections/{col_id}", headers={"X-Tenant-ID": TENANT_ID}
    )
    assert del_resp2.status_code == 200
    assert del_resp2.json() == {"status": "already_inactive"}


def test_collection_not_found(client: TestClient):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.delete(
        f"/api/v1/collections/{fake_id}", headers={"X-Tenant-ID": TENANT_ID}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Collection not found"


def test_get_collection_not_found(client: TestClient):
    fake_id = "00000000-0000-0000-0000-000000000000"
    response = client.get(
        f"/api/v1/collections/{fake_id}/products",
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert response.status_code == 404


def test_add_products_to_collection(client: TestClient):
    col_slug = _slug("col")
    col_resp = client.post(
        "/api/v1/collections/",
        json={"name": "Product Collection", "slug": col_slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = col_resp.json()["id"]

    prod1 = _create_product(_slug("prod"))
    prod2 = _create_product(_slug("prod"))

    add_resp = client.post(
        f"/api/v1/collections/{col_id}/products",
        json={"product_ids": [prod1["id"], prod2["id"]]},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["added"] == 2


def test_add_duplicate_products_graceful(client: TestClient):
    col_slug = _slug("col")
    col_resp = client.post(
        "/api/v1/collections/",
        json={"name": "Dedup Collection", "slug": col_slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = col_resp.json()["id"]

    prod = _create_product(_slug("prod"))

    client.post(
        f"/api/v1/collections/{col_id}/products",
        json={"product_ids": [prod["id"]]},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    add_resp = client.post(
        f"/api/v1/collections/{col_id}/products",
        json={"product_ids": [prod["id"]]},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["added"] == 0


def test_list_collection_products(client: TestClient):
    col_slug = _slug("col")
    col_resp = client.post(
        "/api/v1/collections/",
        json={"name": "List Prod Collection", "slug": col_slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = col_resp.json()["id"]

    prod = _create_product(_slug("prod"))

    client.post(
        f"/api/v1/collections/{col_id}/products",
        json={"product_ids": [prod["id"]]},
        headers={"X-Tenant-ID": TENANT_ID},
    )

    get_resp = client.get(
        f"/api/v1/collections/{col_id}/products",
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == prod["id"]


def test_remove_product_from_collection(client: TestClient):
    col_slug = _slug("col")
    col_resp = client.post(
        "/api/v1/collections/",
        json={"name": "Remove Collection", "slug": col_slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = col_resp.json()["id"]

    prod = _create_product(_slug("prod"))

    client.post(
        f"/api/v1/collections/{col_id}/products",
        json={"product_ids": [prod["id"]]},
        headers={"X-Tenant-ID": TENANT_ID},
    )

    del_resp = client.delete(
        f"/api/v1/collections/{col_id}/products/{prod['id']}",
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert del_resp.status_code == 200
    assert del_resp.json() == {"status": "removed"}


def test_remove_product_not_found(client: TestClient):
    col_slug = _slug("col")
    col_resp = client.post(
        "/api/v1/collections/",
        json={"name": "NotFound Collection", "slug": col_slug},
        headers={"X-Tenant-ID": TENANT_ID},
    )
    col_id = col_resp.json()["id"]

    fake_id = "00000000-0000-0000-0000-000000000000"
    del_resp = client.delete(
        f"/api/v1/collections/{col_id}/products/{fake_id}",
        headers={"X-Tenant-ID": TENANT_ID},
    )
    assert del_resp.status_code == 404
    assert del_resp.json()["detail"] == "Product not found in collection"
