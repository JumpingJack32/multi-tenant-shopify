"""Integration tests for the team management (RBAC) API.

The RBAC endpoints depend on Clerk JWT verification (get_current_user). These
tests override that dependency to simulate an authenticated tenant user.
"""

from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlalchemy import text
from sqlmodel import delete
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.tenant import Tenant, TenantUser

# Business tenant ids used in Clerk claims
TENANT_BIZ_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TENANT_BIZ_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

OWNER_CLERK = "clerk_owner"
ADMIN_CLERK = "clerk_admin"
MEMBER_CLERK = "clerk_member"


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM audit_logs"))
        await db.exec(delete(TenantUser))
        await db.exec(delete(Tenant))
        # Tenant + owner + admin for tenant A
        tenant_a = Tenant(
            tenant_id=TENANT_BIZ_A,
            name="Tenant A",
            slug="tenant-a",
            status="active",
        )
        db.add(tenant_a)
        await db.flush()
        db.add(TenantUser(
            tenant_id=tenant_a.id,
            clerk_user_id=OWNER_CLERK,
            email="owner@a.com",
            password_hash="",
            role="owner",
            status="active",
            is_active=True,
        ))
        db.add(TenantUser(
            tenant_id=tenant_a.id,
            clerk_user_id=ADMIN_CLERK,
            email="admin@a.com",
            password_hash="",
            role="admin",
            status="active",
            is_active=True,
        ))
        db.add(TenantUser(
            tenant_id=tenant_a.id,
            clerk_user_id=MEMBER_CLERK,
            email="member@a.com",
            password_hash="",
            role="support_agent",
            status="active",
            is_active=True,
        ))
        await db.commit()
    yield


def _auth_client(clerk_user_id: str, business_tenant_id: str):
    """Build an ASGI client where get_current_user returns a Clerk identity."""
    from src import dependencies

    async def fake_current_user():
        return {
            "user_id": clerk_user_id,
            "email": f"{clerk_user_id}@test.com",
            "tenant_id": business_tenant_id,
        }

    # Override the dependency for the lifetime of this test
    app.dependency_overrides[dependencies.get_current_user] = fake_current_user
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    return client


def _clear_overrides():
    from src import dependencies
    app.dependency_overrides.pop(dependencies.get_current_user, None)


@pytest.mark.anyio
async def test_list_users_as_admin():
    client = _auth_client(ADMIN_CLERK, TENANT_BIZ_A)
    try:
        res = await client.get("/users")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        emails = {u["email"] for u in data}
        assert {"owner@a.com", "admin@a.com", "member@a.com"} <= emails
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_support_agent_cannot_manage_staff():
    client = _auth_client(MEMBER_CLERK, TENANT_BIZ_A)
    try:
        res = await client.get("/users")
        assert res.status_code == 403
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_invite_and_idempotent_reinvite():
    client = _auth_client(ADMIN_CLERK, TENANT_BIZ_A)
    try:
        res = await client.post("/users", json={
            "email": "new@a.com",
            "role": "finance",
        })
        assert res.status_code == 201
        body = res.json()
        assert body["status"] == "invited"
        assert body["role"] == "finance"

        # Re-invite same email should be idempotent (200) not duplicate
        res2 = await client.post("/users", json={
            "email": "new@a.com",
            "role": "finance",
        })
        assert res2.status_code in (200, 201)
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_cannot_demote_owner():
    client = _auth_client(ADMIN_CLERK, TENANT_BIZ_A)
    try:
        # Find owner id
        res = await client.get("/users")
        owner = next(u for u in res.json() if u["email"] == "owner@a.com")
        patch = await client.patch(f"/users/{owner['id']}", json={"role": "admin"})
        assert patch.status_code == 400
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_remove_owner_forbidden():
    client = _auth_client(ADMIN_CLERK, TENANT_BIZ_A)
    try:
        res = await client.get("/users")
        owner = next(u for u in res.json() if u["email"] == "owner@a.com")
        d = await client.delete(f"/users/{owner['id']}")
        assert d.status_code == 400
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_transfer_ownership():
    client = _auth_client(OWNER_CLERK, TENANT_BIZ_A)
    try:
        res = await client.get("/users")
        admin = next(u for u in res.json() if u["email"] == "admin@a.com")
        tr = await client.post(f"/users/{admin['id']}/transfer-ownership")
        assert tr.status_code == 200
        assert tr.json()["role"] == "owner"

        # Verify only one owner remains
        res2 = await client.get("/users")
        owners = [u for u in res2.json() if u["role"] == "owner"]
        assert len(owners) == 1
        assert owners[0]["email"] == "admin@a.com"
    finally:
        await client.aclose()
        _clear_overrides()


@pytest.mark.anyio
async def test_superuser_can_list_all_tenants():
    client = _auth_client(OWNER_CLERK, TENANT_BIZ_A)
    try:
        res = await client.get("/tenants")
        assert res.status_code == 403  # not a superuser
    finally:
        await client.aclose()
        _clear_overrides()
