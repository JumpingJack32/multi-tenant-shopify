# Storefront Tax Integration — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-storefront-tax-integration.md`

---

## Step 1 — Backend: Cart Model

**File:** `src/orm/models/cart.py`

Add `tax_total: int = Field(default=0, ge=0)` to the `Cart` model.

## Step 2 — Backend: Cart Schema

**File:** `src/orm/schemas/cart.py`

Add `tax_total: int = 0` to `CartResponse`.

## Step 3 — Backend: Cart Endpoint Tax

**File:** `src/routes/storefront.py`

Modify `GET /storefront/cart` to iterate cart items, call `calculate_tax()` per item, sum the results, and set `cart.tax_total`. Same line-by-line loop as the checkout route for penny-perfect consistency.

## Step 4 — Backend: Checkout Route Tax

**File:** `src/routes/storefront.py`

Modify `POST /storefront/checkout` to compute tax per line item using `calculate_tax()`, store `tax_rate`/`tax_amount` on each `OrderItem`, and update order totals respecting `tax_inclusive` mode.

## Step 5 — Frontend: Summary Panel

**File:** `apps/storefront/src/components/checkout/summary-panel.tsx`

Add dynamic tax line after subtotal. Display `£0.00 (Calculated at checkout)` when tax_total is 0 and no address entered.

## Step 6 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
pnpm vitest run --project storefront        # storefront tests passing
```
