"""Tests for the public SaaS plans endpoint."""

from uuid import UUID

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app


@pytest.fixture(autouse=True)
async def seed_test_plan():
    """Ensure at least one public plan exists for testing."""
    async with AsyncSession(async_engine) as session:
        async with session.begin():
            result = await session.execute(
                text("SELECT 1 FROM saas_plans WHERE slug = 'test-plan' LIMIT 1")
            )
            if result.first() is None:
                await session.execute(
                    text("""
                        INSERT INTO saas_plans (id, tenant_id, name, slug, description, price_cents_monthly, price_cents_yearly, trial_days, sort_order, is_public, features, created_at, updated_at)
                        VALUES (:id, :tid, 'Test Plan', 'test-plan', 'A test plan', 1000, 10000, 14, 0, true, '["Feature A", "Feature B"]'::jsonb, NOW(), NOW())
                    """),
                    {"id": UUID("00000000-0000-0000-0000-000000000001"), "tid": UUID("00000000-0000-0000-0000-000000000002")},
                )


@pytest.mark.anyio
async def test_list_plans_returns_public_plans():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/public/plans")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    plan = data[0]
    assert "id" in plan
    assert "name" in plan
    assert "slug" in plan
    assert "price_cents_monthly" in plan
    assert "price_cents_yearly" in plan
    assert "features" in plan
    assert isinstance(plan["features"], list)


@pytest.mark.anyio
async def test_list_plans_excludes_non_public():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/public/plans")

    assert response.status_code == 200
    # Ensure no non-public plans leak through
    for plan in response.json():
        assert plan.get("is_public", True) is True


@pytest.mark.anyio
async def test_list_plans_no_auth_required():
    """Public endpoint should not require any auth headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/public/plans", headers={})

    assert response.status_code == 200
