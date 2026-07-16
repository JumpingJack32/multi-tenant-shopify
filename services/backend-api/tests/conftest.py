import os

os.environ.setdefault("APP_ENV", "test")

from collections.abc import AsyncGenerator
import sys

from fastapi.testclient import TestClient
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Test database isolation ──────────────────────────────────────────
# Tests use a separate database configured via Doppler's TEST_DATABASE_URL.
# The src/database.py module reads APP_ENV=test and TEST_DATABASE_URL to
# create an isolated engine. The dev database is never touched.
#
# Ensure ALL models are registered before any engine operations.
from src.database import async_engine
from src.orm.base import BaseModel
import src.orm.models  # noqa: F401


@pytest.fixture(scope="session", autouse=True)
async def setup_test_database():
    """Create all tables in the isolated test database before tests run,
    drop them after the session completes."""
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator:
    yield {}


from src.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def test_tenant():
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Tenant",
        "slug": "test-tenant",
        "status": "active",
    }
