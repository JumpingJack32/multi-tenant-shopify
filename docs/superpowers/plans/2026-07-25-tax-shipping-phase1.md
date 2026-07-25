# Phase 1: Flat-Rate/Threshold Shipping & Tax Engine — Implementation Plan

**Spec:** Storefront Tax & Shipping Engine (Phase 1)

---

## Step 1 — Backend: Shipping Model + Migration

**Files:** `src/orm/models/shipping.py`, `src/orm/schemas/shipping.py`

- `ShippingMethod` model: `id`, `tenant_id`, `name`, `description`, `rate_type` (FLAT_RATE | THRESHOLD), `base_price` (Decimal), `free_shipping_threshold` (Decimal | None), `is_active`
- Pydantic schemas: `ShippingMethodResponse`, `CreateShippingMethodRequest`, `UpdateShippingMethodRequest`
- Alembic autogenerate migration

---

## Step 2 — Backend: Shipping Service

**File:** `src/services/shipping_service.py`

- `calculate_shipping_rates(db, tenant_id, subtotal)` — queries active methods, evaluates threshold, returns list of `{method, cost}`
- `calculate_shipping_cost(method, subtotal)` — returns 0 if threshold met, else `base_price`

---

## Step 3 — Backend: Cart/Checkout Integration

**File:** `src/routes/storefront.py`

- After cart subtotal is computed, call `calculate_shipping_rates()` + `calculate_tax()`
- Return explicit `shipping_total`, `tax_total`, `grand_total` in cart summary
- Same for checkout — pass calculated values to Stripe Checkout Session

---

## Step 4 — Admin UI: Tax & Shipping Settings

**Files:** `apps/admin/src/app/(app)/settings/shipping/page.tsx`, `apps/admin/src/app/(app)/settings/tax/page.tsx`

- Shipping: list/create/edit shipping methods, flat rate + threshold config
- Tax: toggle enable/disable, rate input (×10000), inclusive/exclusive toggle

---

## Step 5 — Storefront: Cart Drawer Cost Breakdown

**File:** `apps/storefront/src/components/storefront/cart-drawer.tsx`

- Subtotal line (exists)
- Shipping line: "FREE" when threshold met, otherwise calculated rate
- Tax line (exists, refresh from API)
- Grand total line

---

## Step 6 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
