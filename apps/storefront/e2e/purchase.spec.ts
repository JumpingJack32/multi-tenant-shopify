import { test, expect } from "@playwright/test";

const TENANT = "acme-corp";
const API = `http://localhost:8000/api/v1/storefront/${TENANT}`;
const BASE = `http://localhost:3000/${TENANT}`;

test("full storefront purchase loop", async ({ page }) => {
  // 1. Fetch a real variant ID from the seeded data
  const productRes = await fetch(`${API}/products?page_size=1`);
  const productData = await productRes.json();
  const product = productData.data?.[0];
  const variantId = product?.variants?.[0]?.id;
  if (!variantId) throw new Error("No variant found — seed the database first");

  // 2. Browse shop and open a product to verify PLP/PDP rendering
  await page.goto(`${BASE}/shop/all`);
  await page.locator('[data-testid="product-card"]').first().click();
  await page.waitForURL(`**/shop/**`);

  // 3. Verify PDP renders with product info
  await expect(
    page.locator('[data-testid="add-to-cart"]').first(),
  ).toBeVisible();

  // 4. Create a checkout session directly via API (bypasses legacy cart store)
  const sessionRes = await fetch(`${API}/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ variant_id: variantId, quantity: 2 }],
      customer_email: "test@example.com",
    }),
  });
  const sessionData = await sessionRes.json();
  expect(sessionData.session_url).toBeTruthy();

  // 5. Navigate to the Stripe hosted checkout page
  await page.goto(sessionData.session_url);
  await page.waitForURL((url) => url.hostname.includes("stripe.com"), {
    timeout: 15000,
  });

  // 6. Wait for Stripe Checkout page to load and interact
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 });

  // Let Stripe's JS render the form
  await page.waitForTimeout(3000);

  // Take a screenshot for debugging (uncomment to capture)
  // await page.screenshot({ path: "/tmp/stripe-checkout.png" });

  // Try to find and fill the email field on the main page
  const emailField = page.locator('input[type="email"]').first();
  if (await emailField.isVisible()) {
    await emailField.fill("test@example.com");
  }

  // Card fields are inside a Stripe iframe
  const stripeFrame = page
    .frameLocator("iframe[name^='__privateStripeFrame']")
    .first();

  // Fill card details in the iframe
  const cardInput = stripeFrame.locator('[name="cardnumber"]').first();
  if (await cardInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cardInput.fill("4242424242424242");
    await stripeFrame.locator('[name="exp-date"]').first().fill("12/30");
    await stripeFrame.locator('[name="cvc"]').first().fill("123");
  }

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first();
  if (await submitBtn.isVisible()) {
    await submitBtn.click();
  }

  // 7. Verify redirect back to storefront success page
  await page.waitForURL(`**/checkout/success**`, { timeout: 60000 });
  await expect(
    page.locator('[data-testid="order-success-title"]'),
  ).toBeVisible();
});
