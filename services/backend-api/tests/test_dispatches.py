from datetime import datetime, timezone
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.campaign import CampaignTemplate
from src.orm.models.dispatch import CampaignDispatch, CampaignDispatchRecipient, DispatchStatus
from src.orm.models.order import Customer
from src.orm.models.segment import SavedSegment


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(CampaignDispatchRecipient))
        await db.exec(delete(CampaignDispatch))
        await db.exec(delete(CampaignTemplate))
        await db.exec(delete(SavedSegment))
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


@pytest.fixture
async def test_template(tenant_id):
    async with AsyncSession(async_engine) as db:
        tmpl = CampaignTemplate(
            tenant_id=tenant_id,
            name="Test Template",
            subject="Hello {{ customerName }}",
            body_html="<h1>Welcome!</h1>",
            is_active=True,
        )
        db.add(tmpl)
        await db.commit()
        await db.refresh(tmpl)
        return tmpl


@pytest.fixture
async def test_segment(tenant_id):
    async with AsyncSession(async_engine) as db:
        seg = SavedSegment(
            tenant_id=tenant_id,
            name="Test Segment",
            filters={},
            customer_count=0,
        )
        db.add(seg)
        await db.commit()
        await db.refresh(seg)
        return seg


@pytest.mark.anyio
async def test_create_dispatch_snapshots_html_and_populates_recipients(
    client: AsyncClient,
    tenant_id: str,
    test_template,
    test_segment,
):
    async with AsyncSession(async_engine) as db:
        c1 = Customer(id=uuid4(), tenant_id=tenant_id, email="sub1@test.com", email_subscription_status="subscribed")
        c2 = Customer(id=uuid4(), tenant_id=tenant_id, email="sub2@test.com", email_subscription_status="subscribed")
        c3 = Customer(id=uuid4(), tenant_id=tenant_id, email="unsub@test.com", email_subscription_status="unsubscribed")
        db.add_all([c1, c2, c3])
        await db.commit()

    payload = {
        "name": "Summer Sale Launch",
        "template_id": str(test_template.id),
        "segment_id": str(test_segment.id),
        "scheduled_at": "2026-08-01T10:00:00Z",
    }

    response = await client.post("/api/v1/marketing/dispatches", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["name"] == "Summer Sale Launch"
    assert data["total_count"] == 2

    async with AsyncSession(async_engine) as db:
        stmt = select(CampaignDispatchRecipient).where(
            CampaignDispatchRecipient.dispatch_id == data["id"]
        )
        recipients = (await db.exec(stmt)).all()
    assert len(recipients) == 2
    emails = {r.email for r in recipients}
    assert emails == {"sub1@test.com", "sub2@test.com"}


@pytest.mark.anyio
async def test_send_now_dispatch_sets_scheduled_at(
    client: AsyncClient,
    test_template,
    test_segment,
):
    payload = {
        "name": "Send Now Test",
        "template_id": str(test_template.id),
        "segment_id": str(test_segment.id),
        "send_immediately": True,
    }
    response = await client.post("/api/v1/marketing/dispatches", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "scheduled"
    assert data["scheduled_at"] is not None


@pytest.mark.anyio
async def test_cancel_scheduled_dispatch(
    client: AsyncClient,
    tenant_id: str,
    test_template,
    test_segment,
):
    # Create via the API, then cancel
    create_resp = await client.post(
        "/api/v1/marketing/dispatches",
        json={
            "name": "Cancel Test",
            "template_id": str(test_template.id),
            "segment_id": str(test_segment.id),
            "scheduled_at": "2026-08-01T10:00:00Z",
        },
    )
    assert create_resp.status_code == 201
    dispatch_id = create_resp.json()["id"]

    cancel_resp = await client.post(f"/api/v1/marketing/dispatches/{dispatch_id}/cancel")
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "draft"


@pytest.mark.anyio
async def test_list_dispatches_with_status_filter(
    client: AsyncClient,
    tenant_id: str,
    test_template,
    test_segment,
):
    async with AsyncSession(async_engine) as db:
        for i in range(3):
            db.add(CampaignDispatch(
                tenant_id=tenant_id,
                name=f"Dispatch {i}",
                template_id=test_template.id,
                segment_id=test_segment.id,
                template_html=test_template.body_html,
                status=DispatchStatus.SCHEDULED if i < 2 else DispatchStatus.DRAFT,
                total_count=0,
            ))
        await db.commit()

    response = await client.get("/api/v1/marketing/dispatches?status=scheduled")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    for d in data:
        assert d["status"] == "scheduled"
