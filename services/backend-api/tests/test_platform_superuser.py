from uuid import UUID

import pytest
from src.orm.models.tenant import TenantUser
from src.orm.schemas.tenant import TenantUserAuthResponse


class TestTenantUserModel:
    def test_default_is_platform_superuser_false(self):
        user = TenantUser(
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            clerk_user_id="user_test_123",
            email="test@example.com",
            password_hash="hashed_password",
        )
        assert user.is_platform_superuser is False

    def test_set_platform_superuser_true(self):
        user = TenantUser(
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            clerk_user_id="user_test_123",
            email="test@example.com",
            password_hash="hashed_password",
            is_platform_superuser=True,
        )
        assert user.is_platform_superuser is True

    def test_platform_superuser_persists(self):
        user = TenantUser(
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            clerk_user_id="user_test_123",
            email="test@example.com",
            password_hash="hashed_password",
            is_platform_superuser=True,
        )
        user.is_platform_superuser = False
        assert user.is_platform_superuser is False


class TestTenantUserAuthResponseSchema:
    def test_default_is_platform_superuser_false(self):
        response = TenantUserAuthResponse(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            role="admin",
        )
        assert response.is_platform_superuser is False

    def test_explicit_platform_superuser_true(self):
        response = TenantUserAuthResponse(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            role="admin",
            is_platform_superuser=True,
        )
        assert response.is_platform_superuser is True

    def test_schema_includes_all_fields(self):
        response = TenantUserAuthResponse(
            user_id=UUID("00000000-0000-0000-0000-000000000001"),
            email="test@example.com",
            tenant_id=UUID("00000000-0000-0000-0000-000000000001"),
            role="owner",
            is_platform_superuser=True,
        )
        data = response.model_dump()
        assert "is_platform_superuser" in data
        assert data["is_platform_superuser"] is True
