# Storefront E2E Purchase Simulation — Specification

> **Status:** Draft

---

## 1. Value

Verify the complete customer purchase loop across the full stack: storefront UI → cart state → Stripe Checkout → webhook → order creation. Catches frontend/backend integration bugs that unit tests miss (cart total mismatches, redirect failures, webhook timing).

---

## 2. Architecture

```
Playwright script
      │
      ├── 1. Seed database with test products
      ├── 2. Open storefront /[tenant]/shop/all
      ├── 3. Click product → PDP
      ├── 4. Click "Add to Cart"
      ├── 5. Navigate to /[tenant]/checkout
      ├── 6. Enter email → "Proceed to Payment"
      ├── 7. Stripe Checkout page fills test card 4242...
      ├── 8. Submit → redirected to /checkout/success
      └── 9. Verify order exists in DB via API
```

---

## 3. Backend: Richer Seed Data

**File:** `services/backend-api/seed_database.py`

Extend existing product seeds with:

- Realistic `specs` arrays (material, closure, laptop fit)
- Multiple categories (Rucksacks, Boots, T-shirts, Gadgets, Jackets)
- 2-3 variants per product (size/color options)
- `is_active: true` and `status: PUBLISHED` for storefront visibility
- Cloudinary demo image URLs for gallery display

No new model fields — all of these already exist.

---

## 4. Playwright Setup

### Install

```bash
cd apps/storefront && pnpm add -D @playwright/test
cd / && npx playwright install chromium
```

### Test file

**File:** `e2e/purchase.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

const TENANT = "test-tenant";
const BASE = `http://localhost:3000/${TENANT}`;

test("full purchase loop", async ({ page }) => {
  // 1. Browse products
  await page.goto(`${BASE}/shop/all`);
  await page.waitForSelector("text=add to cart", { timeout: 10000 });

  // 2. Click first product card → PDP
  await page.locator('[data-testid="product-card"]').first().click();
  await page.waitForURL(`**/shop/**/**`);

  // 3. Cart interactions: add item & increment quantity
  await page.click('[data-testid="add-to-cart"]');
  await page.click('[data-testid="cart-drawer-trigger"]'); // Open mini-cart
  await page.click('[data-testid="cart-quantity-plus"]'); // Increment quantity

  // 4. Proceed to Checkout
  await page.click('[data-testid="proceed-to-checkout"]');

  // 5. Enter email and submit
  await page.fill('[type="email"]', "test@example.com");
  await page.click("text=Proceed to Payment");

  // 6. Stripe Checkout — hosted page (full redirect, not iframe)
  await page.waitForURL((url) => url.origin.includes("stripe.com"), {
    timeout: 15000,
  });

  await page.fill("#cardNumber", "4242424242424242");
  await page.fill("#cardExpiry", "12/30");
  await page.fill("#cardCvc", "123");
  await page.fill("#billingName", "Test User");
  await page.click('button[type="submit"]');

  // 7. Verify redirect back to storefront success page
  await page.waitForURL(`**/checkout/success**`, { timeout: 30000 });
  await expect(
    page.locator('[data-testid="order-success-title"]'),
  ).toBeVisible();
});
```

### Data attributes

Add `data-testid` attributes to key storefront elements:

| Element                 | Attribute                           |
| ----------------------- | ----------------------------------- |
| Product card            | `data-testid="product-card"`        |
| Add to cart button      | `data-testid="add-to-cart"`         |
| Cart drawer trigger     | `data-testid="cart-drawer-trigger"` |
| Cart quantity increment | `data-testid="cart-quantity-plus"`  |
| Checkout button         | `data-testid="proceed-to-checkout"` |
| Order success title     | `data-testid="order-success-title"` |

---

## 5. CI Integration

**File:** `.github/workflows/ci.yml`

Add an optional E2E job (separate from required jobs to avoid blocking PRs on Stripe dependency):

```yaml
test-e2e:
  name: E2E (Playwright)
  runs-on: ubuntu-latest
  services:
    postgres: { ... }
  steps:
    - uses: actions/checkout@v4
    - run: pnpm install && npx playwright install chromium
    - run: npm run dev & # start storefront + backend
    - run: npx playwright test
```

---

## 6. Risks & Mitigations

| Risk                                               | Mitigation                                                                                                                                                                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stripe Checkout loads in iframe — hard to automate | Playwright can switch to Stripe's domain context via `page.waitForURL` or use Stripe's test publishable key                                                                                                             |
| Stripe test card requires iframe access            | Stripe's test mode allows filling card details in the iframe via `frameLocator`                                                                                                                                         |
| Webhook timing — order not ready on success page   | Add polling retry in the success page assertion (already built into the success page)                                                                                                                                   |
| Stripe cannot reach localhost for webhooks         | Run `stripe listen --forward-to localhost:8000/api/v1/storefront/webhooks/stripe` as a background process during E2E. CI can trigger a signed synthetic webhook event directly to the endpoint using the webhook secret |
| Seed data drifts from production schema            | Seed script is transactional and idempotent — re-run before E2E test                                                                                                                                                    |

---

## 7. Files Changed

| File                                                               | Change                                                                      |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `e2e/purchase.spec.ts`                                             | **New** — Playwright test script                                            |
| `apps/storefront/package.json`                                     | Add `@playwright/test`                                                      |
| `apps/storefront/src/components/storefront/product-card.tsx`       | Add `data-testid="product-card"`                                            |
| `apps/storefront/src/components/storefront/add-to-cart-button.tsx` | Add `data-testid="add-to-cart"`                                             |
| `apps/storefront/src/components/storefront/cart.tsx`               | Add `data-testid="cart-drawer-trigger"`                                     |
| `apps/storefront/src/components/storefront/cart-drawer.tsx`        | Add `data-testid="cart-quantity-plus"`, `data-testid="proceed-to-checkout"` |
| `apps/storefront/src/components/storefront/checkout-form.tsx`      | Add `data-testid="proceed-to-checkout"` (fallback)                          |
| `apps/storefront/src/app/[tenant]/checkout/success/page.tsx`       | Add `data-testid="order-success-title"`                                     |
| `services/backend-api/seed_database.py`                            | Richer product seeds with specs, images, categories                         |
| `.github/workflows/ci.yml`                                         | Optional E2E job                                                            |
