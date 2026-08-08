"""Tests for the guest customer-portal verification service."""

from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.orm.base import BaseModel
from src.orm.models.order import Order, OrderStatus
from src.orm.models.tenant import Tenant
from src.services.portal_service import (
    build_guest_cookie,
    clear_guest_cookie,
    create_guest_portal_token,
    normalize_email,
    parse_guest_portal_token,
    verify_guest,
)

TENANT_BIZ = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(async_engine) as db:
        await db.exec(text("DELETE FROM orders"))
        await db.exec(text("DELETE FROM tenants"))
        tenant = Tenant(tenant_id=TENANT_BIZ, name="Portal Tenant", slug="portal-tenant", status="active")
        db.add(tenant)
        await db.flush()
        db.add(Order(
            tenant_id=TENANT_BIZ,
            customer_email="guest@example.com",
            order_number="SF-1001",
            status=OrderStatus.PAID,
            shipping_address={"postal_code": "SW1A 1AA"},
            total=1000,
        ))
        db.add(Order(
            tenant_id=TENANT_BIZ,
            customer_email="pending@example.com",
            order_number="SF-1002",
            status=OrderStatus.PENDING_PAYMENT,
            shipping_address={"postal_code": "AB1 2CD"},
            total=500,
        ))
        await db.commit()
    yield


class TestNormalizeEmail:
    def test_lower_and_strip(self):
        assert normalize_email("  Foo@Bar.COM ") == "foo@bar.com"
        assert normalize_email("") == ""


class TestVerifyGuest:
    @pytest.mark.anyio
    async def test_email_and_order_number_match(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "guest@example.com", order_number="SF-1001") is True

    @pytest.mark.anyio
    async def test_email_and_zip_match(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "guest@example.com", shipping_zip="SW1A 1AA") is True

    @pytest.mark.anyio
    async def test_pending_order_rejected(self):
        async with AsyncSession(async_engine) as db:
            # PENDING_PAYMENT is not a verified purchase
            assert await verify_guest(db, TENANT_BIZ, "pending@example.com", order_number="SF-1002") is False

    @pytest.mark.anyio
    async def test_wrong_order_number_rejected(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "guest@example.com", order_number="SF-9999") is False

    @pytest.mark.anyio
    async def test_unknown_email_rejected(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "nobody@example.com", order_number="SF-1001") is False

    @pytest.mark.anyio
    async def test_missing_credentials_rejected(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "guest@example.com") is False

    @pytest.mark.anyio
    async def test_tenant_isolation(self):
        async with AsyncSession(async_engine) as db:
            other = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
            assert await verify_guest(db, other, "guest@example.com", order_number="SF-1001") is False

    @pytest.mark.anyio
    async def test_email_normalized_in_verification(self):
        async with AsyncSession(async_engine) as db:
            assert await verify_guest(db, TENANT_BIZ, "  GUEST@example.com ", order_number="SF-1001") is True


class TestGuestToken:
    def test_round_trip(self):
        tok = create_guest_portal_token("Foo@Bar.com", str(uuid4()))
        claims = parse_guest_portal_token(tok)
        assert claims
        assert claims["guest_customer"] == "foo@bar.com"

    def test_invalid_token(self):
        assert parse_guest_portal_token("garbage.token.here") is None


class TestGuestCookie:
    def test_flags(self):
        c = build_guest_cookie("tok")
        assert c["httponly"] is True
        assert c["samesite"] == "lax"
        assert c["secure"] is True
        assert c["max_age"] == 900

    def test_clear(self):
        c = clear_guest_cookie()
        assert c["max_age"] == 0
        assert c["value"] == ""
