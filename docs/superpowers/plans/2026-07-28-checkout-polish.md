# Storefront Checkout Polish — Implementation Plan

**Spec:** Saved payment methods, address book, inline validation

---

## Step 1 — Customer Address Book API

**File:** `services/backend-api/src/routes/storefront.py`

- `GET /{tenant}/customers/{email}/addresses` — return saved customer addresses
- `POST /{tenant}/customers/{email}/addresses` — save new address
- `DELETE /{tenant}/customers/{email}/addresses/{id}` — remove address

The `CustomerAddress` model already exists at `src/orm/models/order.py` with `customer_id`, line1, city, postal_code, country, etc.

## Step 2 — Stripe Saved Payment Methods

**File:** `services/backend-api/src/services/stripe_adapter.py`

- `list_payment_methods(customer_email, tenant_id)` — queries Stripe Customer by email, returns saved cards with last4, brand, exp_month/year, id
- Returns `[{ id, brand, last4, exp_month, exp_year }]`

**File:** `services/backend-api/src/routes/storefront.py`
- `GET /{tenant}/payment-methods?customer_email=` — returns saved cards from Stripe

## Step 3 — Address Selector Component

**File:** `apps/storefront/src/components/checkout/address-selector.tsx`
- Fetches saved addresses for customer email
- Radio-list: click to auto-fill shipping/billing
- "Add new address" toggle switches to manual input

## Step 4 — Saved Payment Selector Component

**File:** `apps/storefront/src/components/checkout/saved-payment-selector.tsx`
- Fetches saved cards from `GET /payment-methods`
- Radio-list showing card brand, last4, expiry
- Selected card ID passed to checkout session creation

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
