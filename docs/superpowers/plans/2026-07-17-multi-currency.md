# Multi-Currency — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-multi-currency.md`

---

## Step 1 — Order Model: Add Ledger Fields

**File:** `src/orm/models/order.py`

Add `exchange_rate: Decimal = Field(default=Decimal("1.0"))`, `base_currency: str = Field(default="GBP", max_length=3)`, `total_base: int = Field(default=0)`.

## Step 2 — Conversion Service

**File:** `src/services/conversion_service.py` (new)

Wrap `RateService.convert()` into a simple `convert_price(amount_pence, from_currency, to_currency, db) -> int`. Handles same-currency early return and Redis cache via existing infrastructure.

## Step 3 — Storefront Product Price Conversion

**File:** `src/routes/storefront.py`

In product listing and detail endpoints, convert variant prices to the shopper's preferred currency using `convert_price()`. Set `display_price` and `display_currency` on response items.

## Step 4 — Storefront Cart Price Conversion

**File:** `src/routes/storefront.py`

In `_build_cart_response`, convert `total`, `subtotal`, and `tax_total` to the shopper's preferred currency using the exchange rate. Non-base currencies are display-only; the checkout records the rate.

## Step 5 — Checkout Rate Capture

**File:** `src/routes/storefront.py`

Modify `POST /storefront/checkout` to capture `exchange_rate`, `base_currency`, and `total_base` on the Order. `total_base` ensures dashboard reporting stays in the tenant's base currency.

## Step 6 — Dashboard: Use total_base

**File:** `src/routes/admin.py`

Update `_kpi_query` to aggregate `COALESCE(total_base, total)` instead of `total` for all revenue metrics.

## Step 7 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
