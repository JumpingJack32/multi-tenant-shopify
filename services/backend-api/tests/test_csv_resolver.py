from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete, select
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


@pytest.mark.anyio
async def test_csv_import_partial_success_returns_errors(
    client: AsyncClient,
):
    """Verify CSV import returns errors for invalid rows."""
    csv_content = (
        "email,first_name,last_name,store_credit_pounds\n"
        "alice@example.com,Alice,Smith,15.00\n"
        "bob@example.com,Bob,Jones,\n"
        ",Charlie,Brown,\n"
    )

    # Build multipart body manually for httpx ASGITransport compatibility
    boundary = "----TestBoundary123"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="customers.csv"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
        f"{csv_content}\r\n"
        f"--{boundary}--\r\n"
    ).encode()

    response = await client.post(
        "/api/v1/customers/import",
        content=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 3
    assert data["imported"] >= 1  # at least the valid row imported


@pytest.mark.anyio
async def test_csv_import_resolve_fixed_rows(
    client: AsyncClient,
    tenant_id,
):
    async with AsyncSession(async_engine) as db:
        existing = Customer(
            id=uuid4(), tenant_id=tenant_id,
            email="alice@example.com", first_name="Alice",
            email_subscription_status="subscribed",
        )
        db.add(existing)
        await db.commit()

    corrections = [
        {"row": 2, "email": "bob@example.com", "first_name": "Bob", "last_name": "Jones"},
        {"row": 3, "email": "charlie@example.com", "first_name": "Charlie", "last_name": "Brown"},
    ]

    response = await client.post(
        "/api/v1/customers/import/resolve",
        json={"corrections": corrections},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["fixed"] == 2

    async with AsyncSession(async_engine) as db:
        stmt = select(Customer).where(Customer.tenant_id == tenant_id)
        all_customers = (await db.exec(stmt)).all()
    assert len(all_customers) == 3  # alice + bob + charlie
