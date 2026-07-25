# Phase 2: Weight-Based Shipping & Stripe Tax — Implementation Plan

**Spec:** Weight-based shipping tiers + Stripe Tax code forwarding

---

## Step 1 — Schema Additions

### Variant model (`product.py`)
- Add `tax_code: Optional[str]` field (max_length=50, for Stripe Tax codes like `txcd_99999999`)
- `weight` and `weight_unit` already exist — unchanged

### ShippingMethod model + schemas (`shipping.py`)
- Add `min_weight: Optional[Decimal]`, `max_weight: Optional[Decimal]`, `price_per_unit_weight: Optional[Decimal]` for WEIGHT_BASED rate type
- Create new Alembic migration

---

## Step 2 — Shipping Service Extension

**File:** `services/backend-api/src/services/shipping_service.py`

- For `WEIGHT_BASED` rate type:
  - Fetch variant weights from cart items via `selectinload(Variant)` or direct DB query
  - Normalize all weights to kilograms (convert g → kg, lb → kg, oz → kg)
  - Calculate total cart weight: `sum(weight_kg * quantity)`
  - Match against `min_weight` / `max_weight` brackets
  - Apply rate: `base_price + (total_weight * price_per_unit_weight)`

---

## Step 3 — Stripe Tax in Checkout Session

**File:** `services/backend-api/src/services/stripe_adapter.py`

- In `CheckoutSessionAdapter.create_checkout()`, read `variant.tax_code` for each line item
- If `tax_code` is set, pass `tax_code` in `price_data.product_data`
- Check `TenantTaxConfig` for a `stripe_tax_enabled` flag (add field if needed)

---

## Step 4 — Admin UI Updates

**File:** `apps/admin/src/components/products/add-product-form.tsx`

- Add Weight (number), Weight Unit (select: kg/g/lb/oz), Tax Code (text) fields to the variant section

**File:** `apps/admin/src/app/(app)/settings/shipping/page.tsx`

- Add Min Weight, Max Weight, Price Per Unit Weight fields when `WEIGHT_BASED` type selected

---

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
