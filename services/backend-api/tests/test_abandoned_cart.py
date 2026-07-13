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
