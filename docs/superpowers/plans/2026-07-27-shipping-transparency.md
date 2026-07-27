# Storefront Shipping & Delivery Transparency — Implementation Plan

**Spec:** Option 1 — Free shipping progress bar + PDP estimator

---

## Step 1 — Cart Drawer Free Shipping Bar

**File:** `apps/storefront/src/components/storefront/cart-drawer.tsx`

- Fetch shipping methods via `GET /api/v1/admin/shipping-methods` (reuse existing)
- Find the lowest `free_shipping_threshold`
- If subtotal < threshold: show progress bar `[(====>----)] Add $X.XX more for FREE shipping`
- If subtotal >= threshold: show `FREE Shipping unlocked`
- Updates reactively when cart changes (TanStack Query refetch)

## Step 2 — PDP Shipping Estimator

**File:** `apps/storefront/src/components/storefront/product-shipping-estimator.tsx`

- Small inline component below add-to-cart
- Shows available shipping methods with rates
- Uses the same `calculate_shipping_rates` data flow (client calculation based on product weight)
- Shows estimated delivery date range

## Step 3 — Wire into PDP

**File:** `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx`

- Import and mount `<ProductShippingEstimator>` below the add-to-cart section

## Step 4 — Verify

```bash
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
