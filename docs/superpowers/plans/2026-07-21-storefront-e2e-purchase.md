# Storefront E2E Purchase Simulation — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-21-storefront-e2e-purchase.md`

---

## Step 1 — Richer Seed Data

**File:** `services/backend-api/seed_database.py`

- Add `specs` arrays, multiple categories, 2-3 variants per product, demo image URLs
- Ensure all products are `is_active: true` and `status: PUBLISHED`

---

## Step 2 — Playwright Setup

```bash
cd apps/storefront && pnpm add -D @playwright/test
cd / && npx playwright install chromium
```

**File:** `e2e/purchase.spec.ts` (new)

---

## Step 3 — data-testid Attributes

Add `data-testid` to these storefront components:

| File                     | Attribute                                                               |
| ------------------------ | ----------------------------------------------------------------------- |
| `product-card.tsx`       | `data-testid="product-card"`                                            |
| `add-to-cart-button.tsx` | `data-testid="add-to-cart"`                                             |
| `cart.tsx`               | `data-testid="cart-drawer-trigger"`                                     |
| `cart-drawer.tsx`        | `data-testid="cart-quantity-plus"`, `data-testid="proceed-to-checkout"` |
| `success/page.tsx`       | `data-testid="order-success-title"`                                     |

---

## Step 4 — Verify

```bash
# Run E2E (requires backend, storefront, and stripe listen running)
cd / && stripe listen --forward-to localhost:8000/api/v1/storefront/webhooks/stripe &
pnpm dev &
npx playwright test e2e/purchase.spec.ts
```
