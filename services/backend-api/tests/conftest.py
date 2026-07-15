import os

os.environ.setdefault("APP_ENV", "test")

from collections.abc import AsyncGenerator
import sys

from fastapi.testclient import TestClient
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Create all tables from model metadata before any tests run
from src.database import async_engine
from src.orm.base import BaseModel


@pytest.fixture(scope="session", autouse=True)
async def ensure_tables():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)


from src.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
async def db_session() -> AsyncGenerator:
    yield {}


@pytest.fixture
def test_tenant():
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Tenant",
        "slug": "test-tenant",
        "status": "active",
    }
