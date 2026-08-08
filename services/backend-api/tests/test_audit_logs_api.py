"""Integration tests for the paginated + CSV audit logs API."""

from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlalchemy import text
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.audit_log import AuditLog
from src.orm.models.tenant import Tenant, TenantUser

TENANT_BIZ = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ADMIN_CLERK = "clerk_admin"


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM audit_logs"))
        await db.exec(delete(TenantUser))
        await db.exec(delete(Tenant))
        tenant = Tenant(tenant_id=TENANT_BIZ, name="Audit Tenant", slug="audit-tenant", status="active")
        db.add(tenant)
        await db.flush()
        db.add(TenantUser(
            tenant_id=tenant.id,
            clerk_user_id=ADMIN_CLERK,
            email="admin@a.com",
            password_hash="",
            role="admin",
            status="active",
            is_active=True,
        ))
        # Seed audit events using the tenant PK (matches get_current_tenant_user)
        for i in range(5):
            db.add(AuditLog(
                tenant_id=tenant.id,
                actor_email="admin@a.com",
                action="orders.refund",
                resource_type="order",
                resource_id=f"order-{i}",
                details={"method": "stripe"},
            ))
        db.add(AuditLog(
            tenant_id=tenant.id,
            actor_email="ops@a.com",
            action="inventory.override",
            resource_type="variant",
            resource_id="variant-1",
            details={"qty": 10},
        ))
        await db.commit()
    yield


def _client():
    from src import dependencies

    async def fake_user():
        return {"user_id": ADMIN_CLERK, "email": "admin@a.com", "tenant_id": TENANT_BIZ}

    app.dependency_overrides[dependencies.get_current_user] = fake_user
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    return client


def _clear():
    from src import dependencies
    app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.anyio
async def test_list_audit_logs_paginated():
    client = _client()
    try:
        res = await client.get("/audit-logs")
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) == 6
        assert body["pagination"]["total"] == 6
        assert body["pagination"]["page"] == 1
    finally:
        await client.aclose()
        _clear()


@pytest.mark.anyio
async def test_filter_by_action():
    client = _client()
    try:
        res = await client.get("/audit-logs", params={"action": "inventory.override"})
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["action"] == "inventory.override"
    finally:
        await client.aclose()
        _clear()


@pytest.mark.anyio
async def test_filter_by_actor_email_ilike():
    client = _client()
    try:
        res = await client.get("/audit-logs", params={"actor_email": "OPS"})
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["actor_email"] == "ops@a.com"
    finally:
        await client.aclose()
        _clear()


@pytest.mark.anyio
async def test_pagination():
    client = _client()
    try:
        res = await client.get("/audit-logs", params={"page_size": 2, "page": 2})
        body = res.json()
        assert len(body["data"]) == 2
        assert body["pagination"]["page"] == 2
        assert body["pagination"]["total_pages"] == 3
    finally:
        await client.aclose()
        _clear()


@pytest.mark.anyio
async def test_export_csv():
    client = _client()
    try:
        res = await client.get("/audit-logs/export")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "attachment" in res.headers["content-disposition"]
        assert "created_at,actor_email,action" in res.text
        assert "inventory.override" in res.text
    finally:
        await client.aclose()
        _clear()


@pytest.mark.anyio
async def test_export_csv_formula_injection_escaped():
    client = _client()
    try:
        async with AsyncSession(async_engine) as db:
            tenant = (await db.exec(select(Tenant).where(Tenant.tenant_id == TENANT_BIZ))).first()
            db.add(AuditLog(
                tenant_id=tenant.id,
                actor_email="=cmd|' /C calc'!A0",
                action="customers.export",
                resource_type="customer",
                details={"note": "=1+1"},
            ))
            await db.commit()
        res = await client.get("/audit-logs/export", params={"action": "customers.export"})
        # Formula-injection guard: dangerous leading chars in top-level cells
        # (actor_email) are neutralized with a leading apostrophe.
        assert "'=cmd|" in res.text
        # Nested JSON values are safely quoted by csv.writer.
        assert '"{""note"": ""=1+1""}"' in res.text or "'=1+1" in res.text
    finally:
        await client.aclose()
        _clear()
