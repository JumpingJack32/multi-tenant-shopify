# Cart & Checkout Refinements — Implementation Plan

**Context:** Close the purchase loop with error-resilient checkout flow.

---

## 1. Checkout Error Handling

**File:** `apps/storefront/src/components/storefront/cart-drawer.tsx`

The backend's `POST /carts/{id}/checkout` already validates stock server-side and returns a descriptive error on insufficient stock. The client currently ignores these errors.

- Catch `checkoutMutation` errors
- Parse error message for stock-related text
- Display inline error banner in the drawer when checkout fails
- Keep the cart open so the user can remove items and retry

## 2. Variant Label Polish

**File:** `apps/storefront/src/components/storefront/cart-drawer.tsx`

- `item.variant_name` is already rendered — no changes needed
- Add structured fallback if `variant_name` is missing: show first option key-value from `item.variant_id` context (already handled by existing code)

## 3. Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
```
