from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Customer


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(Customer))
        await db.commit()


@pytest.fixture
def tenant_id():
    return uuid4()


@pytest.fixture
async def client(tenant_id):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(tenant_id)
        yield ac


@pytest.mark.skip(reason="Requires Stripe test keys configured in Doppler")
@pytest.mark.anyio
async def test_create_checkout_intent_returns_client_secret(
    client: AsyncClient,
    tenant_id,
):
    async with AsyncSession(async_engine) as db:
        from src.orm.models.product import Product, Variant

        p = Product(id=uuid4(), tenant_id=tenant_id, name="Test Product", slug="test-product", is_active=True)
        db.add(p)
        await db.flush()
        v = Variant(id=uuid4(), tenant_id=tenant_id, product_id=p.id, sku="TST-001", price=2500, inventory_quantity=10, is_active=True)
        db.add(v)
        await db.commit()

    response = await client.post(
        f"/api/v1/storefront/test-tenant/checkout/intent",
        json={
            "items": [{"variant_id": str(v.id), "quantity": 2}],
            "customer_email": "buyer@example.com",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "clientSecret" in data
    assert data["amount"] > 0


@pytest.mark.skip(reason="Requires Stripe test keys configured in Doppler")
@pytest.mark.anyio
async def test_checkout_order_creation(
    client: AsyncClient,
    tenant_id,
):
    async with AsyncSession(async_engine) as db:
        from src.orm.models.product import Product, Variant

        p = Product(id=uuid4(), tenant_id=tenant_id, name="Test Product", slug="test-product", is_active=True)
        db.add(p)
        await db.flush()
        v = Variant(id=uuid4(), tenant_id=tenant_id, product_id=p.id, sku="TST-002", price=1500, inventory_quantity=5, is_active=True)
        db.add(v)
        await db.commit()

    response = await client.post(
        f"/api/v1/storefront/test-tenant/orders",
        json={
            "payment_intent_id": "pi_mock_123456",
            "customer_email": "buyer@example.com",
            "shipping_address": {"line1": "123 St", "city": "London", "country": "GB"},
        },
    )
    assert response.status_code == 402  # Payment not completed
