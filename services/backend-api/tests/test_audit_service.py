"""Tests for the audit service — records high-risk actions with actor context."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.orm.base import BaseModel
from src.orm.models.audit_log import AuditLog
from src.services.audit_service import record_audit


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM audit_logs"))
        await db.commit()
    yield


@pytest.mark.anyio
async def test_record_audit_writes_with_actor_context():
    tenant_id = uuid4()
    actor_id = uuid4()
    record_audit(
        tenant_id=tenant_id,
        actor_user_id=actor_id,
        actor_email="owner@a.com",
        action="store_credit.issue",
        resource_type="customer",
        resource_id=str(uuid4()),
        details={"amount": 500},
    )
    # Allow the fire-and-forget task to complete
    import asyncio
    for _ in range(50):
        await asyncio.sleep(0.05)
        async with AsyncSession(async_engine) as db:
            row = (await db.exec(select(AuditLog))).first()
            if row:
                break
    else:
        pytest.fail("audit row never written")

    assert row is not None
    assert row.tenant_id == tenant_id
    assert row.actor_user_id == actor_id
    assert row.actor_email == "owner@a.com"
    assert row.action == "store_credit.issue"
    assert row.details == {"amount": 500}


@pytest.mark.anyio
async def test_multiple_audits():
    for action in ["inventory.override", "customers.export", "settings.manage_staff.invite"]:
        record_audit(
            tenant_id=uuid4(),
            actor_user_id=uuid4(),
            actor_email="admin@a.com",
            action=action,
        )
    import asyncio
    for _ in range(80):
        await asyncio.sleep(0.05)
        async with AsyncSession(async_engine) as db:
            count = (await db.exec(select(AuditLog))).all()
            if len(count) >= 3:
                break
    else:
        pytest.fail("expected 3 audit rows")

    assert len(count) == 3
    actions = {a.action for a in count}
    assert actions == {"inventory.override", "customers.export", "settings.manage_staff.invite"}
