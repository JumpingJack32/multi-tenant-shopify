from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Customer, Order
from src.orm.models.product import Product, Variant


TENANT_ID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(Variant))
        await db.exec(delete(Product))
        await db.exec(delete(Order))
        await db.exec(delete(Customer))
        await db.commit()


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = TENANT_ID
        yield ac


@pytest.mark.anyio
async def test_dashboard_summary_returns_expected_keys(client: AsyncClient):
    async with AsyncSession(async_engine) as db:
        customer = Customer(
            tenant_id=TENANT_ID,
            email="john@test.com",
            first_name="John",
            last_name="Doe",
        )
        db.add(customer)
        await db.flush()

        product = Product(
            tenant_id=TENANT_ID,
            name="Test Product",
            slug="test-product",
        )
        db.add(product)
        await db.flush()

        variant = Variant(
            tenant_id=TENANT_ID,
            product_id=product.id,
            sku="LOW-SKU",
            inventory_quantity=3,
            price=1000,
        )
        db.add(variant)
        await db.flush()

        for status in ["pending", "processing", "shipped", "delivered"]:
            order = Order(
                tenant_id=TENANT_ID,
                customer_id=customer.id,
                order_number=f"ORD-{status}-{uuid4().hex[:8]}",
                status=status,
                total=5000,
                subtotal=5000,
            )
            db.add(order)

        await db.commit()

    response = await client.get("/api/v1/admin/dashboard/summary")

    assert response.status_code == 200
    data = response.json()

    assert data["revenue_mtd"] == 20000
    assert data["revenue_total"] == 20000
    assert data["revenue_prev_mtd"] == 0
    assert data["orders_mtd"] == 4
    assert data["orders_total"] == 4
    assert data["orders_prev_mtd"] == 0
    assert data["aov"] == 5000
    assert data["active_customers"] == 1
    assert data["active_customers_prev"] == 0

    f = data["fulfillment"]
    assert f["unfulfilled"] == 1
    assert f["processing"] == 1
    assert f["shipped"] == 1
    assert f["delivered"] == 1

    assert len(data["low_stock"]) == 1
    assert data["low_stock"][0]["quantity"] == 3
    assert data["low_stock"][0]["sku"] == "LOW-SKU"

    assert len(data["recent_orders"]) == 4
    assert data["recent_orders"][0]["customer_name"] == "John Doe"
    assert data["recent_orders"][0]["status"] == "DELIVERED"
