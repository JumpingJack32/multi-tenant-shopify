# Storefront Currency Switcher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let storefront consumers pick a display/payment currency. All prices convert transparently via a Pricing Interceptor (Custom APIRoute) that converts tagged price fields before serialization.

**Architecture:** A `CurrencyAwareRoute` APIRoute subclass post-processes storefront responses. It walks the Pydantic response model recursively, finds fields tagged `{"is_price": True}`, and converts them from the tenant's base currency to the consumer's chosen currency using the existing `RateService` (Redis-cached exchange rates).

**Tech Stack:** FastAPI, Pydantic v2, SQLModel, React/Next.js, RateService (existing)

## Global Constraints

- Prices are integer cents everywhere (no floats, no Decimals in response models)
- `Field(json_schema_extra={"is_price": True})` is the tagging convention
- Redis-only conversion in the interceptor path (no DB session — the background worker keeps Redis fresh)
- Storefront routes use `/{tenant_slug}` in path, prefix `/api/v1/storefront` in main.py
- Admin routes are untouched (no conversion)
- `Optional[int]` price fields (e.g. `compare_at_price`) also need the `is_price` tag so they're converted when present

---

### Task 1: Tag Price Fields on Storefront Response Models

**Files:**

- Modify: `services/backend-api/src/orm/schemas/storefront.py`
- Modify: `services/backend-api/src/orm/schemas/cart.py`
- Modify: `services/backend-api/src/orm/schemas/order.py`

**Interfaces:**

- Produces: `StorefrontVariantResponse.price` and `.compare_at_price` tagged `is_price`
- Produces: `StorefrontProductResponse.min_price` and `.max_price` tagged `is_price`
- Produces: `CartItemResponse.price` tagged `is_price`
- Produces: `CartResponse.total` tagged `is_price`
- Produces: `OrderResponse.subtotal`, `.tax`, `.shipping`, `.discount`, `.total` tagged `is_price` + `currency_field`
- Produces: `OrderItemResponse.unit_price`, `.total_price`, `.discount` tagged `is_price`

- [ ] **Step 1: Modify `storefront.py` — tag variant and product price fields**

```python
# In StorefrontVariantResponse:
price: int = Field(ge=0, json_schema_extra={"is_price": True})
compare_at_price: Optional[int] = Field(None, ge=0, json_schema_extra={"is_price": True})

# In StorefrontProductResponse:
min_price: int = Field(ge=0, json_schema_extra={"is_price": True})
max_price: int = Field(ge=0, json_schema_extra={"is_price": True})
```

- [ ] **Step 2: Modify `cart.py` — tag cart price fields**

```python
# In CartItemResponse:
price: int = Field(ge=0, json_schema_extra={"is_price": True})

# In CartResponse:
total: int = Field(ge=0, json_schema_extra={"is_price": True})
```

- [ ] **Step 3: Modify `order.py` — tag order price fields with currency_field**

```python
# In OrderResponse:
subtotal: int = Field(ge=0, json_schema_extra={"is_price": True, "currency_field": "currency"})
tax: int = Field(ge=0, json_schema_extra={"is_price": True, "currency_field": "currency"})
shipping: int = Field(json_schema_extra={"is_price": True, "currency_field": "currency"})
discount: int = Field(json_schema_extra={"is_price": True, "currency_field": "currency"})
total: int = Field(json_schema_extra={"is_price": True, "currency_field": "currency"})
# Note: OrderResponse fields are currently plain `int` without ge=0 constraint.
# Add ge=0 constraint for subtotal, tax, shipping, discount, total.
# shipping and discount are before subtotal and total — order in the file matters.

# In OrderItemResponse:
unit_price: int = Field(ge=0, json_schema_extra={"is_price": True, "currency_field": "currency"})
total_price: int = Field(ge=0, json_schema_extra={"is_price": True, "currency_field": "currency"})
discount: int = Field(ge=0, json_schema_extra={"is_price": True, "currency_field": "currency"})
```

Note: `OrderResponse` and `OrderItemResponse` use `PydanticBaseModel` as their base (aliased from `pydantic.BaseModel` in that file). The `json_schema_extra` parameter works identically.

- [ ] **Step 4: Run lint + typecheck to verify**

```bash
cd services/backend-api && uvx ruff check src/orm/schemas/
```

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/orm/schemas/
git commit -m "feat: tag price fields on storefront response models for currency conversion"
```

---

### Task 2: Build PriceConverter + CurrencyAwareRoute

**Files:**

- Create: `services/backend-api/src/core/pricing/__init__.py`
- Create: `services/backend-api/src/core/pricing/interceptor.py`
- Test: `services/backend-api/tests/test_pricing_interceptor.py`

**Interfaces:**

- Consumes: `RateService` from `src.core.exchange_rates.service`, `get_minor_unit` from same module
- Consumes: Tagged response models from Task 1
- Produces: `PriceConverter(target_currency, base_currency)` — has `convert_response(data, model) -> dict`
- Produces: `CurrencyAwareRoute` — APIRoute subclass wrapping storefront router

- [ ] **Step 1: Write the test file**

```python
"""Tests for PriceConverter and CurrencyAwareRoute."""

from decimal import Decimal
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import BaseModel, Field

from src.core.pricing.interceptor import PriceConverter, _apply_rate, get_minor_unit


class MockProduct(BaseModel):
    name: str
    price: int = Field(json_schema_extra={"is_price": True})
    quantity: int  # not a price, should not be converted


class MockOrder(BaseModel):
    total: int = Field(json_schema_extra={"is_price": True, "currency_field": "currency"})
    currency: str
    items: list["MockOrderItem"]


class MockOrderItem(BaseModel):
    unit_price: int = Field(json_schema_extra={"is_price": True})
    label: str


class TestApplyRate:
    def test_converts_cents(self):
        result = _apply_rate(1000, Decimal("1.17"))
        assert result == 1170  # 10.00 * 1.17 = 11.70 → 1170 cents

    def test_rounds_to_nearest_cent(self):
        result = _apply_rate(995, Decimal("1.171"))
        assert result == 1165  # 9.95 * 1.171 = 11.65145 → 1165 cents (rounded)

    def test_multiplication_precision(self):
        result = _apply_rate(500, Decimal("161.665"))
        assert result == 80833  # 500 * 161.665 = 80832.5 → 80833 (rounded up)

    def test_same_currency(self):
        result = _apply_rate(2995, Decimal("1"))
        assert result == 2995


class TestPriceConverter:
    @pytest.fixture
    def converter(self):
        return PriceConverter(target_currency="EUR", base_currency="GBP")

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_converts_tagged_field(self, mock_get_rate, converter):
        mock_get_rate.return_value = Decimal("1.17")
        data = {"name": "Widget", "price": 1000, "quantity": 5}
        result = await converter.convert_response(data, MockProduct)
        assert result["name"] == "Widget"
        assert result["price"] == 1170  # converted
        assert result["quantity"] == 5  # unchanged

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_no_conversion_when_same_currency(self, mock_get_rate, converter):
        converter.target = "GBP"
        data = {"name": "Widget", "price": 1000, "quantity": 5}
        result = await converter.convert_response(data, MockProduct)
        assert result["price"] == 1000  # unchanged
        mock_get_rate.assert_not_called()

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_rate_miss_passes_through(self, mock_get_rate, converter):
        mock_get_rate.side_effect = ValueError("No rate")
        data = {"name": "Widget", "price": 1000, "quantity": 5}
        result = await converter.convert_response(data, MockProduct)
        assert result["price"] == 1000  # pass-through
        assert result["name"] == "Widget"

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_uses_currency_field_hint(self, mock_get_rate, converter):
        mock_get_rate.side_effect = lambda f, t: Decimal("1.17") if f == "EUR" and t == "EUR" else ValueError()
        converter.target = "EUR"
        data = {"total": 2000, "currency": "EUR", "items": []}
        result = await converter.convert_response(data, MockOrder)
        assert result["total"] == 2000  # source == target, rate==1, no conversion needed

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_recurses_into_nested_items(self, mock_get_rate, converter):
        mock_get_rate.return_value = Decimal("1.17")
        data = {
            "total": 3000,
            "currency": "USD",
            "items": [
                {"unit_price": 1000, "label": "Item A"},
                {"unit_price": 2000, "label": "Item B"},
            ],
        }
        result = await converter.convert_response(data, MockOrder)
        assert result["total"] == 3510  # 3000 * 1.17
        assert result["items"][0]["unit_price"] == 1170  # 1000 * 1.17
        assert result["items"][1]["unit_price"] == 2340  # 2000 * 1.17
        assert result["items"][0]["label"] == "Item A"  # unchanged

    @patch("src.core.pricing.interceptor.RateService.get_rate", new_callable=AsyncMock)
    async def test_converts_list_of_models(self, mock_get_rate, converter):
        mock_get_rate.return_value = Decimal("1.17")
        data = [
            {"name": "A", "price": 1000, "quantity": 1},
            {"name": "B", "price": 2000, "quantity": 2},
        ]
        result = await converter.convert_response(data, list[MockProduct])
        assert result[0]["price"] == 1170
        assert result[1]["price"] == 2340
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/backend-api && doppler run -- uv run pytest tests/test_pricing_interceptor.py -v 2>&1 | head -20
```

Expected: ModuleNotFoundError or ImportError (file doesn't exist yet)

- [ ] **Step 3: Write the implementation — `__init__.py`**

```python
# Empty file — package marker
```

- [ ] **Step 4: Write the implementation — `interceptor.py`**

```python
import json
import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel

from src.core.exchange_rates.service import RateService

logger = logging.getLogger(__name__)


def _apply_rate(cents: int, rate: Decimal) -> int:
    """Convert a price in cents using a rate. Both input and output are cents."""
    if rate == Decimal("1"):
        return cents
    return int((Decimal(cents) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class PriceConverter:
    """Walks a response dict/Pydantic model and converts tagged price fields."""

    def __init__(self, target_currency: str, base_currency: str):
        self.target = target_currency.upper()
        self.base = base_currency.upper()
        self._rate_service = RateService()

    async def convert_response(self, data: Any, model: type | None) -> Any:
        if data is None:
            return None
        if isinstance(data, list) and model:
            child = self._list_child_type(model)
            return [await self.convert_response(item, child) for item in data]
        if isinstance(data, dict) and model and issubclass(model, BaseModel):
            return await self._convert_dict(data, model)
        return data

    async def _convert_dict(self, data: dict, model: type[BaseModel]) -> dict:
        result = dict(data)
        for name, info in model.model_fields.items():
            if name not in data:
                continue
            extra = info.json_schema_extra or {}
            if extra.get("is_price"):
                source = self.base
                cf = extra.get("currency_field")
                if cf and cf in data:
                    source_val = data[cf]
                    source = source_val.upper() if isinstance(source_val, str) else source_val
                if source == self.target:
                    continue
                try:
                    rate = await self._rate_service.get_rate(source, self.target)
                    result[name] = _apply_rate(data[name], rate)
                except ValueError:
                    logger.warning("No rate for %s -> %s, passing through", source, self.target)
            elif isinstance(data.get(name), dict):
                child = self._child_type(model, name)
                if child:
                    result[name] = await self.convert_response(data[name], child)
            elif isinstance(data.get(name), list) and data[name]:
                child = self._list_child_from_field(model, name)
                if child:
                    result[name] = [await self.convert_response(item, child) for item in data[name]]
        return result

    @staticmethod
    def _list_child_type(model: type) -> type | None:
        """Extract the element type from `list[SomeModel]`."""
        import typing
        args = getattr(model, "__args__", ())
        return args[0] if args else None

    @staticmethod
    def _child_type(model: type[BaseModel], field_name: str) -> type | None:
        info = model.model_fields.get(field_name)
        if not info:
            return None
        origin = getattr(info.annotation, "__origin__", None)
        if origin is list:
            args = getattr(info.annotation, "__args__", ())
            return args[0] if args else None
        if isinstance(info.annotation, type) and issubclass(info.annotation, BaseModel):
            return info.annotation
        return None

    @staticmethod
    def _list_child_from_field(model: type[BaseModel], field_name: str) -> type | None:
        info = model.model_fields.get(field_name)
        if not info:
            return None
        args = getattr(info.annotation, "__args__", ())
        return args[0] if args else None


class CurrencyAwareRoute(APIRoute):
    """APIRoute subclass that converts tagged price fields before serialization."""

    def get_route_handler(self) -> Callable:
        original_handler = super().get_route_handler()

        async def custom_handler(request: Request) -> Response:
            response = await original_handler(request)

            target = getattr(request.state, "target_currency", None)
            if not target:
                return response
            if not isinstance(response, JSONResponse):
                return response
            response_model = self.response_model
            if not response_model:
                return response

            try:
                body = json.loads(response.body)
                base = getattr(request.state, "base_currency", "GBP")
                converter = PriceConverter(target, base)
                converted = await converter.convert_response(body, response_model)
                return JSONResponse(
                    content=converted,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            except Exception:
                logger.exception("Currency conversion failed, returning unconverted response")
                return response

        return custom_handler
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd services/backend-api && doppler run -- uv run pytest tests/test_pricing_interceptor.py -v
```

Expected: All tests PASS (7 passed)

- [ ] **Step 6: Run ruff lint**

```bash
cd services/backend-api && uvx ruff check src/core/pricing/
```

Expected: All checks passed

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/core/pricing/ tests/test_pricing_interceptor.py
git commit -m "feat: add PriceConverter and CurrencyAwareRoute for storefront currency conversion"
```

---

### Task 3: Build Currency Extractor Middleware

**Files:**

- Create: `services/backend-api/src/core/pricing/middleware.py`
- Test: included in integration tests later

**Interfaces:**

- Produces: Middleware that sets `request.state.target_currency` and `request.state.base_currency`

- [ ] **Step 1: Write the middleware**

```python
"""Middleware that extracts consumer currency preference from request."""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class CurrencyExtractorMiddleware(BaseHTTPMiddleware):
    """Reads preferred_currency cookie or X-Currency header, sets request.state."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        target = (
            request.headers.get("X-Currency")
            or request.cookies.get("preferred_currency")
        )
        request.state.target_currency = target.strip().upper() if target else None
        # base_currency is set by the tenant resolver in the route handler
        # Default fallback if no tenant context yet
        if not hasattr(request.state, "base_currency") or not request.state.base_currency:
            request.state.base_currency = "GBP"
        return await call_next(request)
```

- [ ] **Step 2: Ruff lint**

```bash
cd services/backend-api && uvx ruff check src/core/pricing/middleware.py
```

Expected: All checks passed

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/core/pricing/middleware.py
git commit -m "feat: add CurrencyExtractorMiddleware for storefront currency preference"
```

---

### Task 4: Wire Tenant Base Currency into Middleware

**Files:**

- Modify: `services/backend-api/src/routes/storefront.py` — set `request.state.base_currency` from tenant settings

**Interfaces:**

- Consumes: Tenant's `currency` field from `Tenant.settings`
- Produces: `request.state.base_currency` set to the tenant's actual base currency (not hardcoded)

- [ ] **Step 1: Update storefront tenant resolver to set base_currency**

In `services/backend-api/src/routes/storefront.py`, find `_resolve_tenant()` (around line 30). After setting tenant context, add:

```python
async def _resolve_tenant(db: AsyncSession, tenant_slug: str) -> Tenant:
    stmt = select(Tenant).where(
        Tenant.slug == tenant_slug,
        Tenant.status == "active",
    )
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    set_tenant_context(tenant_id=tenant.id)
    return tenant
```

The `tenant.settings` field contains the currency. In each route handler, after resolving the tenant, set `request.state.base_currency`:

```python
tenant = await _resolve_tenant(db, tenant_slug)
request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
```

Add this line to every storefront route handler that uses `_resolve_tenant`:

- `list_storefront_products` (line ~82)
- `get_storefront_product` (line ~167)
- `get_tenant_settings` (line ~203)
- `create_cart` (line ~265)
- `get_cart` (line ~293)
- `add_cart_item` (line ~305)
- `update_cart_item` (line ~336)
- `remove_cart_item` (line ~362)
- `clear_cart` (line ~383)
- `checkout` (line ~403)
- `get_storefront_order` (line ~478)

- [ ] **Step 2: Run lint**

```bash
cd services/backend-api && uvx ruff check src/routes/storefront.py
```

Expected: All checks passed

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/routes/storefront.py
git commit -m "feat: populate request.state.base_currency from tenant settings"
```

---

### Task 5: Wire CurrencyAwareRoute + Middleware into Storefront

**Files:**

- Modify: `services/backend-api/src/routes/storefront.py` — add route_class to router
- Modify: `services/backend-api/src/main.py` — add middleware, if not already on the storefront router

**Interfaces:**

- Consumes: `CurrencyAwareRoute` and `CurrencyExtractorMiddleware` from Task 2/3
- Produces: Working currency conversion on all storefront endpoints

- [ ] **Step 1: Modify storefront router to use CurrencyAwareRoute**

In `services/backend-api/src/routes/storefront.py`, change line 27:

```python
from src.core.pricing.interceptor import CurrencyAwareRoute

router = APIRouter(route_class=CurrencyAwareRoute)
```

Also add the import for `CurrencyExtractorMiddleware` — but middleware is applied at the app level, not router level in FastAPI. So we add it to main.py instead.

- [ ] **Step 2: Wire the middleware in main.py**

In `services/backend-api/src/main.py`, add after the CORS middleware (around line 57):

```python
from src.core.pricing.middleware import CurrencyExtractorMiddleware

app.add_middleware(CurrencyExtractorMiddleware)
```

This applies to all routes, but the `CurrencyAwareRoute` only acts on tagged fields, so non-storefront routes pass through unchanged (no `is_price` tags on admin models).

- [ ] **Step 3: Verify the storefront router now uses CurrencyAwareRoute**

```bash
cd services/backend-api && grep -n "route_class" src/routes/storefront.py
```

Expected: `router = APIRouter(route_class=CurrencyAwareRoute)`

- [ ] **Step 4: Run lint + verify imports work**

```bash
cd services/backend-api && doppler run -- uv run python -c "
from src.core.pricing.interceptor import CurrencyAwareRoute, PriceConverter
from src.core.pricing.middleware import CurrencyExtractorMiddleware
print('All imports OK')
"
```

Expected: "All imports OK"

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/routes/storefront.py services/backend-api/src/main.py
git commit -m "feat: wire CurrencyAwareRoute and CurrencyExtractorMiddleware into storefront"
```

---

### Task 6: Update Checkout to Pass Consumer's Currency

**Files:**

- Modify: `services/backend-api/src/orm/schemas/cart.py` — update CheckoutRequest default
- Modify: `services/backend-api/src/routes/storefront.py` — read currency from request state

**Interfaces:**

- Consumes: `request.state.target_currency` from the CurrencyExtractorMiddleware
- Produces: Orders created with the consumer's chosen currency

- [ ] **Step 1: Update CheckoutRequest to use dynamic default**

In `services/backend-api/src/orm/schemas/cart.py`, change `CheckoutRequest.currency`:

```python
class CheckoutRequest(BaseModel):
    currency: str = "USD"  # Keep USD as fallback; will be overridden by middleware
    shipping_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
```

The checkout handler will override this from request state. Keep the schema default as-is (`"USD"`) for backward compatibility.

- [ ] **Step 2: Update checkout handler to use consumer's currency**

In `services/backend-api/src/routes/storefront.py`, find the `checkout` function (around line 403). Add before the order creation:

```python
async def checkout(
    tenant_slug: str,
    cart_id: UUID,
    body: CheckoutRequest,
    request: Request,  # Add Request parameter to read state
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    # ... existing tenant resolution and cart fetch ...

    # Use consumer's preferred currency if available, fall back to request body
    preferred = getattr(request.state, "target_currency", None)
    if preferred:
        body.currency = preferred
    # ... rest of checkout logic uses body.currency ...
```

- [ ] **Step 3: Run lint**

```bash
cd services/backend-api && uvx ruff check src/routes/storefront.py
```

Expected: All checks passed

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/orm/schemas/cart.py services/backend-api/src/routes/storefront.py
git commit -m "feat: thread consumer's currency through checkout"
```

---

### Task 7: Build CurrencySwitcher UI Component

**Files:**

- Create: `apps/storefront/src/components/storefront/currency-switcher.tsx`
- Modify: `apps/storefront/src/app/[tenant]/layout.tsx` — add to header
- Modify: `apps/storefront/src/hooks/use-preferences.ts` — or create new hook for preference persistence

**Interfaces:**

- Consumes: Available currencies from `GET /api/v1/exchange-rates` (or static list)
- Produces: Sets `preferred_currency` cookie + localStorage on change

- [ ] **Step 1: Create the CurrencySwitcher component**

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

const CURRENCIES = [
  { code: "GBP", label: "GBP £" },
  { code: "EUR", label: "EUR €" },
  { code: "USD", label: "USD $" },
  { code: "CAD", label: "CAD $" },
  { code: "AUD", label: "AUD $" },
  { code: "JPY", label: "JPY ¥" },
  { code: "CHF", label: "CHF Fr" },
  { code: "SEK", label: "SEK kr" },
  { code: "NOK", label: "NOK kr" },
  { code: "DKK", label: "DKK kr" },
  { code: "PLN", label: "PLN zł" },
  { code: "CZK", label: "CZK Kč" },
  { code: "HUF", label: "HUF Ft" },
  { code: "BRL", label: "BRL R$" },
  { code: "INR", label: "INR ₹" },
  { code: "CNY", label: "CNY ¥" },
  { code: "SGD", label: "SGD $" },
  { code: "HKD", label: "HKD $" },
  { code: "NZD", label: "NZD $" },
  { code: "ZAR", label: "ZAR R" },
] as const;

const COOKIE_NAME = "preferred_currency";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(`(?:^|;\\s*)${name}=([^;]*)`);
  return match?.[1];
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function CurrencySwitcher() {
  const [current, setCurrent] = useState("GBP");

  useEffect(() => {
    const saved = getCookie(COOKIE_NAME);
    if (saved && CURRENCIES.some((c) => c.code === saved)) {
      setCurrent(saved);
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value;
      setCurrent(code);
      setCookie(COOKIE_NAME, code);
      localStorage.setItem(COOKIE_NAME, code);
      // Reload so SSR picks up the new cookie and the backend converts prices
      window.location.reload();
    },
    [],
  );

  return (
    <select
      value={current}
      onChange={handleChange}
      className="bg-transparent text-sm text-muted-foreground hover:text-foreground cursor-pointer border-none outline-none"
      aria-label="Select currency"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Wire into layout header**

In `apps/storefront/src/app/[tenant]/layout.tsx`, add `CurrencySwitcher` to the header nav, between the "Products" link and `CartToggle`:

```tsx
import { CurrencySwitcher } from "@/components/storefront/currency-switcher";

// In the header nav section, after the Products link:
<Link href={`/${tenant}/products`} className="...">
  Products
</Link>
<CurrencySwitcher />
<CartToggle />
```

- [ ] **Step 3: Add SSR cookie reader for initial value**

In `apps/storefront/src/app/[tenant]/layout.tsx`, read the cookie server-side to set initial currency:

```tsx
// In layout props or a separate data fetch
import { cookies } from "next/headers";

// Inside layout component:
const cookieStore = await cookies();
const preferredCurrency = cookieStore.get("preferred_currency")?.value ?? "GBP";
```

Pass `preferredCurrency` to a client hydrator or directly as a prop if needed for initial render.

- [ ] **Step 4: Run typecheck on the storefront**

```bash
pnpm typecheck --filter storefront 2>&1 || pnpm --filter @repo/storefront typecheck
```

Expected: All checks passed

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/components/storefront/currency-switcher.tsx apps/storefront/src/app/[tenant]/layout.tsx
git commit -m "feat: add CurrencySwitcher component to storefront header"
```

---

### Task 8: Integration Verification

**Files:**

- Test: manual E2E verification

- [ ] **Step 1: Run all backend tests**

```bash
cd services/backend-api && doppler run -- uv run pytest tests/ -x -q 2>&1 | tail -15
```

- [ ] **Step 2: Run all frontend tests**

```bash
pnpm vitest run --project admin --reporter verbose 2>&1 | tail -10
```

- [ ] **Step 3: Run full lint + typecheck**

```bash
pnpm lint && pnpm typecheck
```

Expected: All pass

- [ ] **Step 4: Manual E2E smoke test sequence**

```
1. Start backend: doppler run -- uv run uvicorn src.main:app --reload
2. Start storefront: pnpm dev --filter storefront
3. Open storefront in browser
4. Verify prices show in GBP by default
5. Switch to EUR via CurrencySwitcher dropdown
6. Verify page reloads and all prices shown in EUR (€)
7. Verify cookie is set (Application > Cookies > preferred_currency=EUR)
8. Close tab, reopen, verify EUR persists
9. Switch back to GBP, verify prices return to GBP
10. Add item to cart with EUR selected, verify cart total in EUR
11. Complete checkout, verify order confirmation shows EUR prices
```

- [ ] **Step 5: Write backend integration test for CurrencyAwareRoute**

```python
# In tests/test_pricing_interceptor.py, add:

@pytest.mark.asyncio
async def test_interceptor_converts_on_route_response():
    """Test that CurrencyAwareRoute actually converts prices on a real endpoint."""
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from pydantic import BaseModel, Field
    from src.core.pricing.interceptor import CurrencyAwareRoute
    from src.core.pricing.middleware import CurrencyExtractorMiddleware
    from unittest.mock import patch

    app = FastAPI()
    app.add_middleware(CurrencyExtractorMiddleware)

    from fastapi import APIRouter
    router = APIRouter(route_class=CurrencyAwareRoute)

    class TestProduct(BaseModel):
        name: str
        price: int = Field(json_schema_extra={"is_price": True})

    @router.get("/test")
    async def test_endpoint():
        return TestProduct(name="Widget", price=1000)

    app.include_router(router)
    client = TestClient(app)

    with patch("src.core.pricing.interceptor.RateService.get_rate") as mock:
        mock.return_value = Decimal("1.17")
        response = client.get("/test", headers={"X-Currency": "EUR"})
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Widget"
        assert data["price"] == 1170  # converted
```

- [ ] **Step 6: Run the integration test**

```bash
cd services/backend-api && doppler run -- uv run pytest tests/test_pricing_interceptor.py -v
```

Expected: All tests pass (including new integration test)

- [ ] **Step 7: Final commit**

```bash
git add tests/test_pricing_interceptor.py
git commit -m "test: add integration test for CurrencyAwareRoute response conversion"
```
