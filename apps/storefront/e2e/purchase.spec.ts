import { test, expect } from "@playwright/test";

const TENANT = "test-tenant";
const BASE = `http://localhost:3000/${TENANT}`;

test("full storefront purchase loop with cart adjustments", async ({
  page,
}) => {
  // 1. Browse shop and open a product
  await page.goto(`${BASE}/shop/all`);
  await page.locator('[data-testid="product-card"]').first().click();
  await page.waitForURL(`**/shop/**`);

  // 2. Add item to cart
  await page.click('[data-testid="add-to-cart"]');

  // 3. Open cart drawer and increment quantity
  await page.click('[data-testid="cart-drawer-trigger"]');
  await page.click('[data-testid="cart-quantity-plus"]');

  // 4. Proceed to checkout
  await page.click('[data-testid="proceed-to-checkout"]');

  // 5. Wait for redirect to Stripe hosted checkout
  await page.waitForURL((url) => url.origin.includes("stripe.com"), {
    timeout: 15000,
  });

  // 6. Fill Stripe test card on the hosted page
  await page.fill("#email", "test@example.com");
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
