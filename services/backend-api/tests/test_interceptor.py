"""Unit tests for PriceConverter, CurrencyAwareRoute, and utility functions."""

import os
os.environ.setdefault("DATABASE_URL", "sqlite:///test.db")
os.environ.setdefault("CLERK_SECRET_KEY", "sk_test_placeholder")
os.environ.setdefault("CLERK_PUBLISHABLE_KEY", "pk_test_placeholder")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_placeholder")
os.environ.setdefault("CLERK_JWKS_URL", "https://placeholder.clerk.accounts.dev")
os.environ.setdefault("JWT_SECRET", "test-secret")

from decimal import Decimal
from typing import Optional
from unittest.mock import patch

from pydantic import BaseModel, Field
import pytest

from src.core.pricing.interceptor import (
    PriceConverter,
    _apply_rate,
    _list_child_type,
    _list_child_from_field,
)


# ---------------------------------------------------------------------------
# _list_child_type
# ---------------------------------------------------------------------------

class TestListChildType:
    def test_list_of_model(self):
        alias = list["MockProduct"]
        assert _list_child_type(alias) is not None

    def test_bare_type(self):
        assert _list_child_type(int) is None

    def test_none(self):
        assert _list_child_type(None) is None


# ---------------------------------------------------------------------------
# _apply_rate
# ---------------------------------------------------------------------------

class TestApplyRate:
    def test_converts_cents(self):
        result = _apply_rate(1000, Decimal("1.17"))
        assert result == 1170

    def test_rounds_to_nearest_cent(self):
        result = _apply_rate(995, Decimal("1.171"))
        assert result == 1165

    def test_multiplication_precision(self):
        result = _apply_rate(500, Decimal("161.665"))
        assert result == 80833

    def test_same_currency(self):
        result = _apply_rate(2995, Decimal("1"))
        assert result == 2995

    def test_zero_input(self):
        result = _apply_rate(0, Decimal("1.5"))
        assert result == 0

    def test_rounds_up_at_boundary(self):
        result = _apply_rate(1000, Decimal("1.005"))
        assert result == 1005

    def test_rounds_down_at_boundary(self):
        result = _apply_rate(1000, Decimal("1.004"))
        assert result == 1004

    def test_large_numbers(self):
        result = _apply_rate(999999999, Decimal("2"))
        assert result == 1999999998


# ---------------------------------------------------------------------------
# PriceConverter
# ---------------------------------------------------------------------------

class MockProduct(BaseModel):
    name: str
    price: int = Field(json_schema_extra={"is_price": True})


class MockVariant(BaseModel):
    sku: str
    price: int = Field(json_schema_extra={"is_price": True})


class MockProductWithVariants(BaseModel):
    name: str
    price: int = Field(json_schema_extra={"is_price": True})
    variants: list[MockVariant] = []


class MockNested(BaseModel):
    inner_price: int = Field(json_schema_extra={"is_price": True})


class MockParent(BaseModel):
    child: MockNested
    parent_price: int = Field(json_schema_extra={"is_price": True})


class TestPriceConverter:
    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_converts_single_price_field(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("1.17")
        converter = PriceConverter(target_currency="EUR", base_currency="GBP")
        data = {"name": "Test", "price": 1000}
        result = await converter.convert_response(data, MockProduct)
        assert result["price"] == 1170
        assert result["name"] == "Test"

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_same_currency_no_conversion(self, mock_get_rate):
        converter = PriceConverter(target_currency="GBP", base_currency="GBP")
        data = {"name": "Test", "price": 1000}
        result = await converter.convert_response(data, MockProduct)
        assert result["price"] == 1000
        mock_get_rate.assert_not_called()

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_none_data(self, mock_get_rate):
        converter = PriceConverter(target_currency="EUR")
        result = await converter.convert_response(None, MockProduct)
        assert result is None
        mock_get_rate.assert_not_called()

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_empty_dict(self, mock_get_rate):
        converter = PriceConverter(target_currency="EUR")
        mock_get_rate.return_value = Decimal("1.17")
        data: dict = {}
        result = await converter.convert_response(data, MockProduct)
        assert result == {}

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_list_of_models(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("1.17")
        converter = PriceConverter(target_currency="EUR", base_currency="GBP")
        data = [
            {"name": "A", "price": 1000},
            {"name": "B", "price": 2000},
        ]
        result = await converter.convert_response(data, list[MockProduct])
        assert result[0]["price"] == 1170
        assert result[1]["price"] == 2340

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_rate_service_raises_value_error(self, mock_get_rate):
        mock_get_rate.side_effect = ValueError("No rate")
        converter = PriceConverter(target_currency="XYZ", base_currency="GBP")
        data = {"name": "Test", "price": 1000}
        result = await converter.convert_response(data, MockProduct)
        assert result["price"] == 1000

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_base_model_instance(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("1.17")
        converter = PriceConverter(target_currency="EUR", base_currency="GBP")
        instance = MockProduct(name="Test", price=1000)
        result = await converter.convert_response(instance)
        assert isinstance(result, dict)
        assert result["price"] == 1170

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_nested_model_child_price(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("2")
        converter = PriceConverter(target_currency="USD", base_currency="GBP")
        data = {
            "name": "Product",
            "price": 500,
            "variants": [
                {"sku": "A", "price": 1000},
                {"sku": "B", "price": 2000},
            ],
        }
        result = await converter.convert_response(data, MockProductWithVariants)
        assert result["price"] == 1000
        assert result["variants"][0]["price"] == 2000
        assert result["variants"][1]["price"] == 4000

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_non_price_field_unchanged(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("1.5")
        converter = PriceConverter(target_currency="USD")
        data = {"name": "Test", "quantity": 5, "price": 1000}
        result = await converter.convert_response(data, MockProduct)
        assert result["name"] == "Test"
        assert result["price"] == 1500

    @patch("src.core.pricing.interceptor.RateService.get_rate")
    async def test_multiple_calls_caches_rate(self, mock_get_rate):
        mock_get_rate.return_value = Decimal("1.17")
        converter = PriceConverter(target_currency="EUR", base_currency="GBP")
        data1 = {"name": "A", "price": 1000}
        data2 = {"name": "B", "price": 2000}
        result1 = await converter.convert_response(data1, MockProduct)
        result2 = await converter.convert_response(data2, MockProduct)
        assert result1["price"] == 1170
        assert result2["price"] == 2340
        assert mock_get_rate.call_count == 2


# ---------------------------------------------------------------------------
# CurrencyAwareRoute
# ---------------------------------------------------------------------------

class TestCurrencyAwareRoute:
    def test_route_subclass(self):
        from src.core.pricing.interceptor import CurrencyAwareRoute
        from starlette.routing import Route
        assert issubclass(CurrencyAwareRoute, Route)

    def test_can_instantiate(self):
        from src.core.pricing.interceptor import CurrencyAwareRoute
        async def dummy(request):
            return None
        route = CurrencyAwareRoute("/test", endpoint=dummy)
        assert route.path == "/test"


# ---------------------------------------------------------------------------
# _list_child_from_field
# ---------------------------------------------------------------------------

class TestListChildFromField:
    def test_annotation_is_list(self):
        from pydantic import Field
        field = Field(default_factory=list)
        field.annotation = list["int"]
        result = _list_child_from_field(field)
        assert result is not None
