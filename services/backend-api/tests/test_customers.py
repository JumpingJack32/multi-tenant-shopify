from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.order import Customer, CustomerAddress


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(CustomerAddress))
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
async def test_list_customers_empty(client: AsyncClient):
    response = await client.get("/api/v1/customers/")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["data"] == []


@pytest.mark.anyio
async def test_get_customer_not_found(client: AsyncClient):
    response = await client.get(f"/api/v1/customers/{uuid4()}")
    assert response.status_code == 404
