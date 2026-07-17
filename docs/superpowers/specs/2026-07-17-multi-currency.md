# Multi-Currency — Specification

> **Status:** Draft  
> **Prerequisites:** Storefront currency switcher (existing), exchange rate service (existing), `formatCurrency` in tenant-orm/utils

---

## 1. What Already Exists

| Asset                 | Location                                | Status                                                             |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Currency switcher UI  | `storefront/currency-switcher.tsx`      | 12 currencies, stores preference in cookie                         |
| Exchange rate service | `src/core/exchange_rates/`              | Providers (Frankfurter, OER), Redis cache, `RateService.convert()` |
| Price display helper  | `packages/shared-utils/src/currency.ts` | `formatCents(cents, currency, locale)` — defaults to GBP           |
| Admin price display   | `packages/tenant-orm/src/utils.ts`      | `formatCurrency(cents, currencyCode)` — defaults to GBP            |
| Order model           | `src/orm/models/order.py:50`            | `currency: str` — stored per-order                                 |
| Tenant settings       | `seed_database.py`                      | `settings.currency` defaults to GBP                                |

---

## 2. What's Missing

| Gap                               | Detail                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Storefront price conversion**   | Product/variant prices are shown in the tenant's base currency only. No conversion to the shopper's preferred currency.   |
| **Checkout currency enforcement** | Cart totals are in base currency. The checkout endpoint accepts a `currency` field but doesn't convert.                   |
| **Exchange rate display**         | No UI anywhere showing current rates or the rate used at time of order.                                                   |
| **Admin order currency**          | Orders are created in the tenant's base currency. Multi-currency orders would need the rate captured at transaction time. |

---

## 3. Scope

**In scope:**

1. Storefront product prices displayed in the shopper's preferred currency (converted via exchange rates)
2. Cart totals reflect the shopper's preferred currency
3. Exchange rate snapshot captured at checkout and stored on the order
4. Currency switcher persists and drives all price displays

**Out of scope:**

- Admin creating orders in arbitrary currencies
- Real-time exchange rate updates on existing orders
- Multiple currencies per order

---

## 4. Backend: Price Conversion Hook

**File:** `src/routes/storefront.py`

The storefront already resolves the tenant's base currency and the shopper's preferred currency (from cookie/header via `CurrencyExtractorMiddleware`). The gap: product prices returned by storefront endpoints are not converted.

Add a conversion step to the storefront product listing and detail endpoints:

```python
from src.services.conversion_service import convert_price

preferred = getattr(request.state, "target_currency", None)
base = getattr(request.state, "base_currency", None)

if preferred and base and preferred != base:
    for product in products:
        for variant in product.variants:
            converted = await convert_price(variant.price, base, preferred, db)
            variant.display_price = converted
            variant.display_currency = preferred
```

## 5. Backend: Conversion Service

**File:** `src/services/conversion_service.py` (new)

```python
from src.core.exchange_rates.service import RateService

async def convert_price(
    amount_pence: int,
    from_currency: str,
    to_currency: str,
    db,
) -> int:
    """Convert a price from one currency to another using cached exchange rates.
    Returns amount in the target currency's minor unit (pence/cents)."""
    if from_currency == to_currency:
        return amount_pence

    svc = RateService()
    converted = await svc.convert(
        amount=Decimal(amount_pence) / 100,
        from_currency=from_currency,
        to_currency=to_currency,
        db=db,
    )
    return round(converted * 100)
```

## 6. Backend: Capture Rate at Checkout

**File:** `src/routes/storefront.py` — modify `POST /storefront/checkout`

When creating the order, capture the exchange rate used and store both the billed amount and the base-currency equivalent for ledger integrity:

```python
# On the Order model (new fields):
exchange_rate: Decimal = Field(default=Decimal("1.0"))
base_currency: str = Field(default="GBP")
total_base: int = Field(default=0)  # Base-currency pence for reporting

# In checkout:
order.currency = preferred or body.currency or base_currency
order.base_currency = base_currency
if preferred and preferred != base_currency:
    rate = await svc.get_rate(from_currency=base_currency, to_currency=preferred)
    order.exchange_rate = rate
    order.total_base = round(Decimal(order.total) / rate)
else:
    order.total_base = order.total
```

This ensures dashboard analytics aggregating `SUM(total_base)` always report in the tenant's base currency regardless of customer currency choices.

## 7. Frontend: Currency-Aware Price Display

**File:** `apps/storefront/src/lib/storefront-api.ts`

The storefront API client already accepts a `currency` parameter. Ensure all product and cart API calls pass the preferred currency from the cookie/localStorage.

The existing `formatCents` utility already accepts a currency code and locale — no change needed.

## 8. Files Changed

| File                                        | Change                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `src/services/conversion_service.py`        | **New** — wraps `RateService.convert()` for storefront use         |
| `src/routes/storefront.py`                  | Convert prices in product/cart endpoints; capture rate at checkout |
| `src/orm/models/order.py`                   | Add `exchange_rate`, `base_currency` fields                        |
| `src/orm/schemas/order.py`                  | Add fields to response                                             |
| `apps/storefront/src/lib/storefront-api.ts` | Ensure `currency` param is passed on all calls                     |
| `seed_database.py`                          | Add new order columns                                              |

---

## 9. Dashboard Impact

The `GET /admin/dashboard/summary` endpoint must aggregate `total_base` instead of `total` for revenue metrics. Otherwise, a customer paying in USD would add dollar amounts to a GBP chart axis.

**Change:** In `src/routes/admin.py` `_kpi_query`, replace `SUM(total)` with `SUM(total_base)`. For orders without `total_base` (legacy), `COALESCE(total_base, total)` falls back to `total`.

---

## 10. Risks

| Risk                                   | Mitigation                                                                                                 |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Exchange rate service requires Redis   | Service checks `settings.redis_enabled`; falls back to DB-backed rates or returns base currency unchanged  |
| Rounding differences across currencies | Convert at checkout and freeze the rate on the order — the customer sees a fixed amount                    |
| Performance impact on product listing  | Rate is cached in Redis (from Phase 1); conversion is a single DB/Redis call per currency, not per product |
| Shopper switches currency mid-session  | Cart is always recomputed on fetch; prices update automatically                                            |
