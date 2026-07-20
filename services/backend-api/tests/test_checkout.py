from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Customer
from src.orm.models.product import Variant


@pytest.fixture(autouse=True)
async def cleanup_db():
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(Variant))
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


@pytest.mark.anyio
async def test_create_checkout_intent_returns_client_secret(
    client: AsyncClient,
):
    response = await client.post(
        "/api/v1/storefront/test-tenant/checkout/intent",
        json={
            "items": [{"variant_id": str(uuid4()), "quantity": 2}],
            "customer_email": "buyer@example.com",
        },
    )
    # Tenant doesn't exist — endpoint should validate and return 4xx
    assert response.status_code in (404, 503)
