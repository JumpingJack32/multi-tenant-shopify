"""Tests for abandoned cart recovery."""

from datetime import datetime, timezone

import pytest

from src.orm.models.cart import Cart, CartItem, CartStatus


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
            unsubscribe_token="test-token",
        )
        assert result is True

    async def test_create_email_service_returns_log(self):
        from src.services.email_service import LogEmailService, create_email_service

        svc = create_email_service()
        assert isinstance(svc, LogEmailService)
