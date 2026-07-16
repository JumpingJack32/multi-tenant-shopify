# Storefront Currency Switcher — Pricing Interceptor

## Scope

Add a consumer-facing currency switcher to the storefront. The tenant sets their base currency in Admin settings. The consumer picks a display/payment currency via a UI toggle. All storefront prices are converted server-side through a **Pricing Interceptor** — a transparent APIRoute layer that converts tagged price fields before serialization.

Depends on: exchange rate service (built 2026-07-12), integer cents standardization (previous).

## 1. Price Field Tagging

Every storefront response model marks its price fields using `json_schema_extra`:

```python
class StorefrontProductResponse(BaseModel):
    name: str
    min_price: int = Field(json_schema_extra={"is_price": True})
    max_price: int = Field(json_schema_extra={"is_price": True})

class CartResponse(BaseModel):
    total: int = Field(json_schema_extra={"is_price": True})
    items: list[CartItemResponse]

class CartItemResponse(BaseModel):
    unit_price: int = Field(json_schema_extra={"is_price": True})
    line_total: int = Field(json_schema_extra={"is_price": True})

class OrderResponse(BaseModel):
    total: int = Field(json_schema_extra={"is_price": True, "currency_field": "currency"})
    currency: str
    items: list[OrderItemResponse]

class OrderItemResponse(BaseModel):
    unit_price: int = Field(json_schema_extra={"is_price": True})
    total_price: int = Field(json_schema_extra={"is_price": True})
```

The `currency_field` hint tells the interceptor to read the source currency from that sibling field (for orders where currency may differ from the tenant base).

### Models to tag

| Router                 | Models                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `GET /settings`        | None needed (no prices)                                                                                               |
| `GET /products`        | `StorefrontProductResponse.min_price`, `.max_price`                                                                   |
| `GET /products/{slug}` | `StorefrontProductResponse.min_price`, `.max_price` + `StorefrontVariantResponse.price`                               |
| `POST /carts`          | `CartResponse.total` + `CartItemResponse.unit_price`, `.line_total`                                                   |
| `GET /carts/{id}`      | same                                                                                                                  |
| `POST /checkout`       | `OrderResponse.subtotal`, `.tax`, `.shipping`, `.discount`, `.total` + `OrderItemResponse.unit_price`, `.total_price` |
| `GET /orders/{id}`     | same                                                                                                                  |

## 2. Currency Extractor (Middleware)

A lightweight middleware on the **storefront router only** that resolves the consumer's currency preference and attaches it to `request.state`:

```
Source priority:
  1. X-Currency header (API clients, programmatic access)
  2. preferred_currency cookie (browser, persisted preference)
  3. Fallback: tenant's base_currency (no conversion needed)
```

```python
@app.middleware("http")
async def currency_extractor_middleware(request: Request, call_next):
    target = (
        request.headers.get("X-Currency")
        or request.cookies.get("preferred_currency")
    )
    request.state.target_currency = target.upper() if target else None
    # base_currency set by tenant resolver from settings
    request.state.base_currency = getattr(request.state, "base_currency", "GBP")
    return await call_next(request)
```

The tenant's base currency is already available via the existing tenant resolution (`_resolve_tenant()` sets tenant context). The middleware enriches `request.state` with the consumer's chosen target.

## 3. PriceConverter

A stateless service that walks a response body dict and converts tagged price fields:

```python
class PriceConverter:
    def __init__(self, target_currency: str, base_currency: str):
        self.target = target_currency
        self.base = base_currency
        self.rate_service = RateService()

    async def convert_response(
        self, data: Any, model: type[BaseModel] | None
    ) -> Any:
        if data is None:
            return None
        if isinstance(data, list) and model:
            child = self._list_child_model(model)
            return [await self.convert_response(item, child) for item in data]
        if isinstance(data, dict) and model:
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
                    source = data[cf]
                rate = await self.rate_service.get_rate(source, self.target)
                if rate is not None:
                    converted = _apply_rate(data[name], rate, get_minor_unit(self.target))
                    result[name] = converted
            elif isinstance(data.get(name), (dict, list)):
                child = self._child_model(model, name)
                if child:
                    result[name] = await self.convert_response(data[name], child)
        return result
```

### Conversion logic

For each `is_price` field:

1. Read `currency_field` hint (default: tenant's `base_currency`)
2. Call `RateService.get_rate(source_currency, target_currency)` — **Redis-only** path
3. `RateService.get_rate()` reads Redis (populated by the background refresh worker every N hours)
4. Compute: `converted_cents = round(cents * rate)` with minor-unit rounding
5. Return converted cents

**Redis-only by design**: The `CurrencyAwareRoute` handler runs after the route function returns, during response serialization. It does not have access to the DI-injected DB session, and creating one here would couple serialization to database I/O. The background worker keeps Redis fresh, so the cache-hit path covers nearly all requests. If Redis is cold or the rate is missing, the interceptor passes the price through unconverted and logs a warning — the stale price is better than a 500 error on a product page.

### Recursion safety

`convert_response` handles:

- **dict** → match to model fields, recurse into nested models
- **list** → extract child model type from `List[ChildModel]`, recurse per item
- **scalar** → pass through unchanged
- **nested dict in list field** → `_child_model()` resolves `List[CartItemResponse]` to `CartItemResponse`
- **pagination wrappers** → `{"data": [...], "pagination": {...}}` — the `response_model` for paginated endpoints defines `data` as `List[InnerModel]`, which the interceptor walks naturally

## 4. CurrencyAwareRoute (APIRoute subclass)

```python
class CurrencyAwareRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original = super().get_route_handler()

        async def handler(request: Request) -> Response:
            response = await original(request)

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
                return response

        return handler
```

### Application

Applied only to the storefront router:

```python
storefront_router = APIRouter(route_class=CurrencyAwareRoute)
```

Admin routes are untouched — they always display in the tenant's base currency.

## 5. Storefront Currency Switcher UI

A dropdown in the storefront header that lets consumers pick their preferred currency.

### Component

`CurrencySwitcher` — client component in `apps/storefront/src/components/storefront/currency-switcher.tsx`

- Renders a `<select>` or dropdown with common currencies
- On change: writes to `localStorage.preferred_currency` + cookie `preferred_currency` (for SSR), re-renders all price displays
- Reads initial value from cookie on mount
- Persists preference across sessions

### Currency list (initial)

GBP (default), EUR, USD, CAD, AUD, JPY, CHF, SEK, NOK, DKK, PLN, CZK, HUF, BRL, INR, CNY, SGD, HKD, NZD, ZAR

Derived from the exchange rate provider's available currencies — we should fetch the available list from `GET /api/v1/exchange-rates` and render only supported currencies.

### Header placement

```
[Store Name]    [Products]    [Currency ▼]    [🛒 CartToggle]
```

### Edge cases

- If the preferred currency is the same as the tenant's base currency, the interceptor returns the response unchanged (no conversion overhead)
- If rates are unavailable for a currency pair, the interceptor passes the price through unconverted and logs a warning
- On checkout, the payment intent is created in the consumer's chosen currency; Stripe handles settlement in the tenant's base currency

## 6. Admin: Tenant Base Currency

Add `base_currency` to the tenant settings schema. Currently tenant settings have a `currency` field — this becomes the base currency.

Single field addition — no migration needed if the field already exists on the tenant model. If not, add:

```python
class TenantSettings(BaseModel):
    base_currency: str = "GBP"
```

The Admin UI already has a settings page where this can be exposed.

## 7. Data Flow (End-to-End)

```
Consumer visits storefront
  │
  ├─ Tenant resolver → tenant.base_currency = "GBP"
  │
  ├─ SSR layout reads preferred_currency cookie →
  │   renders CurrencySwitcher with selected value
  │
  ├─ PLP fetch: GET /api/v1/storefront/{tenant}/products
  │   │
  │   ├─ Route handler returns StorefrontProductResponse
  │   │   (prices in base currency cents)
  │   │
  │   ├─ CurrencyAwareRoute intercepts:
  │   │   ├─ Reads request.state.target_currency = "EUR"
  │   │   ├─ Finds min_price, max_price tagged is_price
  │   │   ├─ PriceConverter.convert_response()
  │   │   │   ├─ 1 GBP → RateService.get_rate_bridged(GBP, EUR)
  │   │   │   │   → checks Redis → checks DB → 1.17
  │   │   │   └─ min_price: 2995 → 3504 cents (€35.04)
  │   │   └─ Returns JSONResponse with converted prices
  │   │
  │   └─ ProductCard renders formatCents(3504, "EUR") → "€35.04"
  │
  ├─ PDP: same flow per product
  │
  ├─ Add to cart:
  │   ├─ POST /carts with currency in body
  │   ├─ Cart stored with converted prices in EUR
  │   └─ CartDrawer shows EUR prices
  │
  └─ Checkout:
      ├─ POST /checkout with currency: "EUR"
      ├─ Order created with presentment_currency: "EUR"
      ├─ Stripe PaymentIntent in EUR
      └─ Order confirmation shows EUR prices
```

### Ratios

- Display-only switching (PLP, PDP): no DB writes, pure conversion
- Cart creation: cart stored with converted prices (snapshot at time of add)
- Checkout: presentment currency persisted on Order; exchange rate at time of purchase recorded for reconciliation

## 8. Error Handling

| Scenario                      | Behavior                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Rate unavailable (Redis miss) | Pass-through unconverted, log warning                                          |
| Redis down                    | Redis client returns None, pass-through unconverted                            |
| Provider unreachable          | Background worker handles retry; existing Redis cache still serves stale rates |
| Invalid currency code         | Ignore target, use base currency (no conversion)                               |
| Missing field tag             | Field not converted (schema review catches this)                               |

## 9. Implementation Order

1. Tag price fields on all storefront response models
2. Build `PriceConverter` with recursive walker
3. Build `CurrencyAwareRoute` APIRoute subclass
4. Wire currency extractor middleware
5. Apply `CurrencyAwareRoute` to storefront router
6. Build `CurrencySwitcher` UI component
7. Test: unit tests for PriceConverter, integration tests for CurrencyAwareRoute
8. Test: E2E — pick EUR on storefront, verify all prices converted, checkout creates order in EUR

## 10. Future Considerations

- **Rate locking at checkout**: Persist the exchange rate used when the cart is created, so the total doesn't shift between cart and payment
- **Per-product manual overrides**: The existing `VariantPrice` table lets tenants pin specific prices per market. The interceptor should check this before the fallback conversion
- **Admin reporting**: All admin reports are in base currency — no conversion needed
- **Abandoned cart recovery**: Cart totals in the email need to reference the saved presentment currency
