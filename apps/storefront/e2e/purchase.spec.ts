import { test, expect } from "@playwright/test";
import Stripe from "stripe";

const TENANT = "acme-corp";
const API = `http://localhost:8000/api/v1/storefront/${TENANT}`;
const BASE = `http://localhost:3000/${TENANT}`;

const stripeSecret = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
const stripeClient = new Stripe(stripeSecret, {
  apiVersion: "2024-12-18.acacia" as any,
});

test("full storefront purchase pipeline", async ({ page }) => {
  // ── Phase A: Storefront UI ──────────────────────────────────────────

  // Fetch a real variant ID from the seeded data
  const productRes = await fetch(`${API}/products?page_size=1`);
  const productData = await productRes.json();
  const product = productData.data?.[0];
  const variantId = product?.variants?.[0]?.id;
  if (!variantId) throw new Error("No variant found — seed the database first");

  // Browse PLP and open a product
  await page.goto(`${BASE}/shop/all`);
  await page.waitForTimeout(2000);
  await page
    .locator('[data-testid="product-card"]')
    .first()
    .click({ timeout: 10000 });
  // Wait for PDP URL: /shop/{category}/{slug} (3 segments after tenant)
  await page.waitForURL(`**/shop/*/*`);

  // Verify PDP renders with add-to-cart
  await expect(
    page.locator('[data-testid="add-to-cart"]').first(),
  ).toBeVisible();

  // Call checkout session API directly (bypasses legacy cart store)
  const sessionRes = await fetch(`${API}/checkout/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ variant_id: variantId, quantity: 2 }],
      customer_email: "test@example.com",
    }),
  });
  expect(sessionRes.ok).toBe(true);
  const sessionData = await sessionRes.json();
  expect(sessionData.session_id).toBeTruthy();
  expect(sessionData.session_url).toBeTruthy();

  // ── Phase B: Synthetic Webhook ──────────────────────────────────────

  // Build a signed checkout.session.completed event
  const webhookPayload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionData.session_id,
        payment_status: "paid",
        status: "complete",
        metadata: { tenant_slug: TENANT },
      },
    },
  });

  const signature = stripeClient.webhooks.generateTestHeaderString({
    payload: webhookPayload,
    secret: webhookSecret,
  });

  const whRes = await fetch(
    `http://localhost:8000/api/v1/storefront/webhooks/stripe`,
    {
      method: "POST",
      headers: {
        "stripe-signature": signature,
        "Content-Type": "application/json",
      },
      body: webhookPayload,
    },
  );
  expect(whRes.ok).toBe(true);

  // ── Phase C: Verify Success Page ────────────────────────────────────

  // Navigate to the success page — it polls for the order with retries
  await page.goto(
    `${BASE}/checkout/success?session_id=${sessionData.session_id}`,
    { waitUntil: "networkidle" },
  );
  await expect(page.locator('[data-testid="order-success-title"]')).toBeVisible(
    { timeout: 30000 },
  );
});
