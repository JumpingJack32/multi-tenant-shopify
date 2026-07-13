"""Tests for abandoned cart recovery."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.orm.models.cart import Cart, CartStatus
from src.services.abandoned_cart import (
    AbandonedCartService,
    build_recovery_url,
    sign_unsubscribe_token,
    verify_unsubscribe_token,
)
from src.services.email_service import LogEmailService


class TestCartModel:
    def test_cart_has_abandoned_cart_fields(self):
        """Cart model includes all abandoned cart tracking fields."""
        assert hasattr(Cart, "email")
        assert hasattr(Cart, "status")
        assert hasattr(Cart, "last_reminded_at")
        assert hasattr(Cart, "unsubscribed")
        assert hasattr(Cart, "completed_at")

    def test_cart_status_enum_values(self):
        assert CartStatus.ACTIVE == "active"
        assert CartStatus.COMPLETED == "completed"
        assert CartStatus.ABANDONED == "abandoned"

    def test_cart_status_default_is_active(self):
        """Default factory for status should be ACTIVE."""
        field_info = Cart.model_fields.get("status")
        assert field_info is not None
        default = field_info.default
        if default is None and field_info.default_factory:
            default = field_info.default_factory()
        assert default == CartStatus.ACTIVE


class TestEmailService:
    async def test_log_email_service_sends(self):
        from src.services.email_service import LogEmailService

        svc = LogEmailService()
        result = await svc.send_abandoned_cart(
            to_email="test@example.com",
            cart={"id": "abc", "items": [{"product_name": "Widget", "quantity": 1, "unit_price": 1000}]},
            recovery_url="https://example.com/cart?recover=abc",
            tenant_name="Test Store",
            currency="GBP",
            unsubscribe_token="test-token",
        )
        assert result is True

    async def test_create_email_service_returns_log(self):
        from src.services.email_service import LogEmailService, create_email_service

        svc = create_email_service()
        assert isinstance(svc, LogEmailService)


class TestTokenUtils:
    def test_sign_and_verify_token(self):
        cart_id = uuid.uuid4()
        email = "test@example.com"
        secret = "test-secret"

        token = sign_unsubscribe_token(cart_id, email, secret)
        payload = verify_unsubscribe_token(token, secret)

        assert str(payload["cart_id"]) == str(cart_id)
        assert payload["email"] == email

    def test_verify_wrong_secret_fails(self):
        cart_id = uuid.uuid4()
        token = sign_unsubscribe_token(cart_id, "test@example.com", "secret1")
        with pytest.raises(ValueError, match="Invalid token"):
            verify_unsubscribe_token(token, "wrong-secret")

    def test_verify_tampered_token_fails(self):
        cart_id = uuid.uuid4()
        token = sign_unsubscribe_token(cart_id, "test@example.com", "secret")
        with pytest.raises(ValueError, match="Invalid token"):
            verify_unsubscribe_token(token[:-1] + "X", "secret")

    def test_build_recovery_url_without_domain(self):
        url = build_recovery_url("my-store", uuid.UUID(int=1))
        assert url == "https://my-store/cart?recover=00000000-0000-0000-0000-000000000001"

    def test_build_recovery_url_with_domain(self):
        url = build_recovery_url("my-store", uuid.UUID(int=1), tenant_domain="shop.example.com")
        assert url == "https://shop.example.com/cart?recover=00000000-0000-0000-0000-000000000001"


class TestAbandonedCartService:
    @pytest.fixture
    def db_session(self):
        """Return a mock AsyncSession."""
        return AsyncMock()

    @pytest.fixture
    def email_service(self):
        return AsyncMock(spec=LogEmailService)

    @pytest.fixture
    def service(self, db_session, email_service):
        return AbandonedCartService(db_session, email_service)

    async def test_process_no_candidates(self, service, db_session):
        """When no carts qualify, no emails are sent."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db_session.execute.return_value = result_mock

        count = await service.process_abandoned_carts()

        assert count == 0
        db_session.commit.assert_called_once()

    async def test_process_with_candidates(self, service, db_session, email_service):
        """Carts meeting criteria are processed and email is sent."""
        mock_cart = MagicMock(spec=Cart)
        mock_cart.id = uuid.uuid4()
        mock_cart.email = "buyer@example.com"
        mock_cart.unsubscribed = False
        mock_cart.items = []
        mock_cart.tenant_id = uuid.uuid4()
        mock_tenant = MagicMock()
        mock_tenant.slug = "my-store"
        mock_tenant.name = "My Store"
        mock_tenant.domain = "shop.example.com"
        mock_tenant.settings = {"currency": "EUR"}
        mock_tenant.tenant_id = mock_cart.tenant_id

        cart_result = MagicMock()
        cart_result.scalars.return_value.all.return_value = [mock_cart]
        tenant_result = MagicMock()
        tenant_result.scalars.return_value.all.return_value = [mock_tenant]
        db_session.execute.side_effect = [cart_result, tenant_result]
        email_service.send_abandoned_cart.return_value = True

        count = await service.process_abandoned_carts()

        assert count == 1
        assert mock_cart.last_reminded_at is not None
        db_session.commit.assert_called_once()
        email_service.send_abandoned_cart.assert_awaited_once()
        # Verify currency and domain were passed through
        call_kwargs = email_service.send_abandoned_cart.call_args[1]
        assert call_kwargs["currency"] == "EUR"
        assert "shop.example.com" in call_kwargs["recovery_url"]


class TestUnsubscribeEndpoint:
    @pytest.fixture
    def db_session(self):
        return AsyncMock()

    @pytest.fixture
    def test_app(self, db_session):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from src.dependencies import get_db
        from src.routes.public import router

        app = FastAPI()
        app.dependency_overrides[get_db] = lambda: db_session
        app.include_router(router, prefix="/api/v1/public")
        return TestClient(app)

    def test_unsubscribe_invalid_token(self, test_app):
        response = test_app.post("/api/v1/public/carts/unsubscribe/invalid-token")
        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"]

    def test_unsubscribe_valid_token(self, test_app, db_session):
        from src.config import settings
        from src.orm.models.cart import Cart

        cart = Cart(tenant_id=uuid.uuid4(), email="test@example.com")

        async def mock_get(model, ident):
            if model == Cart and str(ident) == str(cart.id):
                return cart
            return None

        db_session.get.side_effect = mock_get

        token = sign_unsubscribe_token(cart.id, "test@example.com", settings.jwt_secret)
        response = test_app.post(f"/api/v1/public/carts/unsubscribe/{token}")
        assert response.status_code == 200

        assert cart.unsubscribed is True
        db_session.commit.assert_awaited_once()
