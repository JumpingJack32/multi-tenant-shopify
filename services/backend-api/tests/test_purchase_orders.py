import os

os.environ.setdefault("APP_ENV", "test")

import pytest
from uuid import UUID, uuid4
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Order, OrderItem
from src.orm.models.product import Product, Variant, Inventory, Location
from src.orm.models.purchase_order import (
    OrderFulfillmentLink,
    POSequence,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from src.database import async_engine

TENANT_A = UUID("00000000-0000-0000-0000-000000000001")
TENANT_B = UUID("00000000-0000-0000-0000-000000000002")


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        for tid in [TENANT_A, TENANT_B]:
            loc = Location(name="Default Warehouse", tenant_id=tid, is_active=True)
            db.add(loc)
        await db.commit()
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(OrderFulfillmentLink))
        await db.exec(delete(PurchaseOrderItem))
        await db.exec(delete(PurchaseOrder))
        await db.exec(delete(POSequence))
        await db.exec(text("DELETE FROM cart_items"))
        await db.exec(delete(OrderItem))
        await db.exec(delete(Order))
        await db.exec(delete(Inventory))
        await db.exec(delete(Variant))
        await db.exec(delete(Product))
        await db.exec(delete(Location))
        await db.exec(delete(Supplier))
        await db.commit()


from sqlalchemy import text


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
async def seeded_supplier(client_a: AsyncClient) -> dict:
    resp = await client_a.post("/api/v1/suppliers", json={
        "name": "Acme Corp",
        "contact_email": "orders@acme.com",
        "delivery_method": "manual_email",
    })
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def seeded_product_with_supplier(client_a: AsyncClient, seeded_supplier: dict) -> dict:
    """Create a product with supplier via the inventory endpoint."""
    resp = await client_a.post("/api/v1/inventory", json={
        "name": "Test Widget",
        "sku": "TST-001",
        "supplier": seeded_supplier["name"],
        "price": 1999,
        "stock": 100,
    })
    assert resp.status_code == 201
    return resp.json()


class TestSuppliers:
    async def test_create_supplier(self, client_a: AsyncClient):
        resp = await client_a.post("/api/v1/suppliers", json={
            "name": "New Supplier",
            "contact_email": "info@new.com",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "New Supplier"
        assert body["contact_email"] == "info@new.com"
        assert body["delivery_method"] == "manual_email"
        assert UUID(body["id"])

    async def test_create_duplicate_supplier_name(self, client_a: AsyncClient):
        await client_a.post("/api/v1/suppliers", json={"name": "Duplicate"})
        resp = await client_a.post("/api/v1/suppliers", json={"name": "Duplicate"})
        assert resp.status_code == 409

    async def test_list_suppliers_empty(self, client_a: AsyncClient):
        resp = await client_a.get("/api/v1/suppliers")
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0

    async def test_list_suppliers_with_items(self, client_a: AsyncClient, seeded_supplier: dict):
        resp = await client_a.get("/api/v1/suppliers")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["name"] == "Acme Corp"

    async def test_get_supplier(self, client_a: AsyncClient, seeded_supplier: dict):
        resp = await client_a.get(f"/api/v1/suppliers/{seeded_supplier['id']}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Acme Corp"

    async def test_get_supplier_404(self, client_a: AsyncClient):
        resp = await client_a.get(f"/api/v1/suppliers/{uuid4()}")
        assert resp.status_code == 404

    async def test_update_supplier(self, client_a: AsyncClient, seeded_supplier: dict):
        resp = await client_a.patch(f"/api/v1/suppliers/{seeded_supplier['id']}", json={
            "name": "Acme Updated",
            "contact_email": "new@acme.com",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Acme Updated"
        assert body["contact_email"] == "new@acme.com"

    async def test_delete_supplier(self, client_a: AsyncClient, seeded_supplier: dict):
        resp = await client_a.delete(f"/api/v1/suppliers/{seeded_supplier['id']}")
        assert resp.status_code == 204

    async def test_tenant_isolation_supplier(self, client_a: AsyncClient, client_b: AsyncClient, seeded_supplier: dict):
        resp = await client_b.get("/api/v1/suppliers")
        assert resp.json()["data"] == []


class TestPurchaseOrders:
    async def test_create_po_from_seeded_supplier(self, client_a: AsyncClient, seeded_supplier: dict):
        """Manual PO creation as a stand-in for auto-generation testing."""
        resp = await client_a.post("/api/v1/inventory", json={
            "name": "PO Widget",
            "sku": "PO-SKU-001",
            "supplier": seeded_supplier["name"],
            "price": 10.00,
            "stock": 50,
        })
        assert resp.status_code == 201
        product = resp.json()
        variant_id = product["variants"][0]["id"]

        # Create a Sales Order to trigger auto-generation
        so_payload = {
            "order_number": "SO-1001",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "PO Widget",
                "sku": "PO-SKU-001",
                "quantity": 2,
                "unit_price": 10.00,
                "total_price": 20.00,
            }],
            "subtotal": 20.00,
            "total": 20.00,
        }
        resp = await client_a.post("/api/v1/orders/", json=so_payload)
        assert resp.status_code == 201, f"SO creation failed: {resp.text}"

        # Check that a PO was auto-generated
        resp = await client_a.get("/api/v1/purchase-orders")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]) > 0

        po = body["data"][0]
        assert po["status"] == "pending_review"
        assert po["fulfillment_strategy"] == "dropship"
        assert po["supplier_name"] == "Acme Corp"
        assert len(po["items"]) == 1
        assert po["items"][0]["quantity"] == 2

    async def test_list_purchase_orders_empty(self, client_a: AsyncClient):
        resp = await client_a.get("/api/v1/purchase-orders")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    async def test_pending_queue(self, client_a: AsyncClient, seeded_supplier: dict):
        resp = await client_a.get("/api/v1/purchase-orders/pending")
        assert resp.status_code == 200

    async def test_po_lifecycle(self, client_a: AsyncClient, seeded_product_with_supplier: dict):
        variant_id = seeded_product_with_supplier["variants"][0]["id"]
        so_payload = {
            "order_number": "SO-LIFECYCLE",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "Test Widget",
                "sku": "TST-001",
                "quantity": 1,
                "unit_price": 1999,
                "total_price": 1999,
            }],
            "subtotal": 1999,
            "total": 1999,
        }
        resp = await client_a.post("/api/v1/orders/", json=so_payload)
        assert resp.status_code == 201

        resp = await client_a.get("/api/v1/purchase-orders")
        po_id = resp.json()["data"][0]["id"]

        pending_review = await client_a.get(f"/api/v1/purchase-orders/{po_id}")
        assert pending_review.json()["status"] == "pending_review"

        approve = await client_a.post(f"/api/v1/purchase-orders/{po_id}/approve")
        assert approve.status_code == 200
        assert approve.json()["status"] == "sent"

        confirm = await client_a.patch(f"/api/v1/purchase-orders/{po_id}", json={"status": "confirmed"})
        assert confirm.status_code == 200
        assert confirm.json()["status"] == "confirmed"

        tracking = await client_a.patch(f"/api/v1/purchase-orders/{po_id}", json={
            "status": "in_transit",
            "tracking_number": "TRACK123",
            "carrier": "UPS",
        })
        assert tracking.status_code == 200
        assert tracking.json()["status"] == "in_transit"
        assert tracking.json()["tracking_number"] == "TRACK123"

        deliver = await client_a.patch(f"/api/v1/purchase-orders/{po_id}", json={"status": "closed"})
        assert deliver.status_code == 200
        assert deliver.json()["status"] == "closed"

    async def test_po_cancel(self, client_a: AsyncClient, seeded_product_with_supplier: dict):
        variant_id = seeded_product_with_supplier["variants"][0]["id"]
        so_payload = {
            "order_number": "SO-CANCEL",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "Test Widget",
                "sku": "TST-001",
                "quantity": 1,
                "unit_price": 1999,
                "total_price": 1999,
            }],
            "subtotal": 1999,
            "total": 1999,
        }
        resp = await client_a.post("/api/v1/orders/", json=so_payload)
        assert resp.status_code == 201

        resp = await client_a.get("/api/v1/purchase-orders")
        po_id = resp.json()["data"][0]["id"]

        cancel = await client_a.post(f"/api/v1/purchase-orders/{po_id}/cancel")
        assert cancel.status_code == 200
        assert cancel.json()["status"] == "cancelled"

    async def test_po_dashboard_kpi(self, client_a: AsyncClient, seeded_product_with_supplier: dict):
        variant_id = seeded_product_with_supplier["variants"][0]["id"]
        so_payload = {
            "order_number": "SO-DASH",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "Test Widget",
                "sku": "TST-001",
                "quantity": 1,
                "unit_price": 1999,
                "total_price": 1999,
            }],
            "subtotal": 1999,
            "total": 1999,
        }
        await client_a.post("/api/v1/orders/", json=so_payload)

        resp = await client_a.get("/api/v1/admin/dashboard/summary")
        assert resp.status_code == 200
        body = resp.json()
        assert body["pending_pos"]["count"] >= 1
        assert body["pending_pos"]["total"] >= 0


class TestSupplierEdgeCases:
    async def test_delete_supplier_with_products(
        self,
        client_a: AsyncClient,
        seeded_product_with_supplier: dict,
    ):
        product = seeded_product_with_supplier
        # Get the supplier ID from the product
        resp = await client_a.get(f"/api/v1/inventory/{product['id']}")
        resp.json()["supplier"]

        sup_resp = await client_a.get("/api/v1/suppliers")
        supplier_id = sup_resp.json()["data"][0]["id"]

        # Try to delete the supplier — should fail due to RESTRICT FK
        del_resp = await client_a.delete(f"/api/v1/suppliers/{supplier_id}")
        assert del_resp.status_code in (409, 500)  # RESTRICT raises DB error

    async def test_po_list_filters(self, client_a: AsyncClient, seeded_product_with_supplier: dict):
        variant_id = seeded_product_with_supplier["variants"][0]["id"]
        so_payload = {
            "order_number": "SO-FILTER",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "Test Widget",
                "sku": "TST-001",
                "quantity": 1,
                "unit_price": 1999,
                "total_price": 1999,
            }],
            "subtotal": 1999,
            "total": 1999,
        }
        await client_a.post("/api/v1/orders/", json=so_payload)

        resp = await client_a.get("/api/v1/purchase-orders?status=pending_review")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) > 0

        resp = await client_a.get("/api/v1/purchase-orders?status=closed")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 0

    async def test_po_tracking_update(self, client_a: AsyncClient, seeded_product_with_supplier: dict):
        variant_id = seeded_product_with_supplier["variants"][0]["id"]
        so_payload = {
            "order_number": "SO-TRACK",
            "status": "paid",
            "items": [{
                "variant_id": variant_id,
                "product_name": "Test Widget",
                "sku": "TST-001",
                "quantity": 1,
                "unit_price": 1999,
                "total_price": 1999,
            }],
            "subtotal": 1999,
            "total": 1999,
        }
        await client_a.post("/api/v1/orders/", json=so_payload)

        resp = await client_a.get("/api/v1/purchase-orders")
        po_id = resp.json()["data"][0]["id"]

        await client_a.post(f"/api/v1/purchase-orders/{po_id}/approve")
        await client_a.patch(f"/api/v1/purchase-orders/{po_id}", json={"status": "confirmed"})
        track = await client_a.patch(f"/api/v1/purchase-orders/{po_id}", json={
            "status": "in_transit",
            "tracking_number": "1Z999AA10123456784",
            "carrier": "UPS",
        })
        assert track.status_code == 200
        body = track.json()
        assert body["tracking_number"] == "1Z999AA10123456784"
        assert body["carrier"] == "UPS"
