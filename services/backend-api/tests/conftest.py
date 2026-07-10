import os

os.environ.setdefault("APP_ENV", "test")

import sys
from collections.abc import AsyncGenerator

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
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
