# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: purchase.spec.ts >> full storefront purchase loop
- Location: e2e/purchase.spec.ts:7:1

# Error details

```
TimeoutError: page.waitForLoadState: Timeout 20000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e4]:
    - generic [ref=e5]:
        - banner [ref=e6]:
            - generic [ref=e8]:
                - link "Back to iGroup sandbox" [ref=e9] [cursor=pointer]:
                    - /url: http://localhost:8000/acme-corp/checkout
                    - generic [ref=e11]:
                        - img [ref=e12]
                        - generic [ref=e14]: Back
                        - generic [ref=e16]:
                            - img [ref=e18]
                            - heading "iGroup sandbox" [level=1] [ref=e20]
                - generic [ref=e21]: Sandbox
        - generic [ref=e24]:
            - heading "Rocket Skates" [level=2] [ref=e25]:
                - generic [ref=e27]: Rocket Skates
            - generic [ref=e29]:
                - generic [ref=e32]: £599.98
                - generic [ref=e39]: Qty 2, £299.99 each
    - generic [ref=e40]:
        - main [ref=e41]:
            - generic [ref=e44]:
                - generic [ref=e45]:
                    - iframe [ref=e51]:
                        - generic [ref=f4e6]:
                            - iframe [ref=f4e11]:
                                - button "Apple Pay" [ref=f17e5] [cursor=pointer]:
                                    - img [ref=f17e7]:
                                        - img "Apple Logo" [ref=f17e8]
                            - button "Pay securely with Onelink" [ref=f4e14] [cursor=pointer]:
                                - img [ref=f4e17]
                            - iframe [ref=f4e32]:
                                - button "Pay with Klarna" [ref=f18e4]:
                                    - img [ref=f18e9] [cursor=pointer]
                            - iframe [ref=f4e37]:
                                - button "Amazon Pay - Use your Amazon Pay Sandbox test account" [ref=f19e3]:
                                    - img "Amazon Pay" [ref=f19e7] [cursor=pointer]
                    - generic [ref=e52]:
                        - separator [ref=e53]
                        - paragraph [ref=e54]: Or
                - heading "Contact information" [level=2] [ref=e55]
            - generic [ref=e59]:
                - generic [ref=e60]:
                    - generic [ref=e67]:
                        - generic [ref=e68]: Email
                        - generic [ref=e71]: test@example.com
                    - heading "Payment method" [level=2] [ref=e73]
                - generic [ref=e74]:
                    - list [ref=e75]:
                        - listitem [ref=e80]:
                            - generic [ref=e89]:
                                - generic [ref=e93]:
                                    - radio "Card" [ref=e94]
                                    - generic [ref=e96]: Card
                                    - generic:
                                        - generic:
                                            - generic:
                                                - img "Visa"
                                        - generic:
                                            - generic:
                                                - img "MasterCard"
                                        - generic:
                                            - generic:
                                                - img "American Express"
                                        - generic:
                                            - img "UnionPay"
                                            - img "JCB"
                                            - img "Discover"
                                            - img "Diners Club"
                                - generic:
                                    - button "Pay with card"
                        - listitem [ref=e101]:
                            - generic [ref=e110]:
                                - generic [ref=e114]:
                                    - radio "Klarna" [ref=e115]
                                    - generic [ref=e117]: Klarna
                                - generic:
                                    - button "Pay with Klarna"
                        - listitem [ref=e122]:
                            - generic [ref=e131]:
                                - generic [ref=e135]:
                                    - radio "Revolut Pay" [ref=e136]
                                    - generic [ref=e138]: Revolut Pay
                                - generic:
                                    - button "Pay with Revolut"
                    - generic [ref=e151]:
                        - checkbox "Save my information for faster checkout" [ref=e153] [cursor=pointer]
                        - generic [ref=e154]:
                            - generic [ref=e157] [cursor=pointer]: Save my information for faster checkout
                            - generic [ref=e159]: Pay securely at iGroup sandbox and everywhere Onelink is accepted.
                - button "Pay" [ref=e164] [cursor=pointer]:
                    - generic:
                        - generic [ref=e166]: Pay
                        - generic [ref=e167]: Processing
                    - img [ref=e172]
                    - img [ref=e177]
            - generic [ref=e179]:
                - checkbox "I am an AI agent acting on behalf of someone else" [ref=e180]
                - text: I am an AI agent acting on behalf of someone else
        - contentinfo [ref=e182]:
            - link "Powered by Stripe" [ref=e184] [cursor=pointer]:
                - /url: https://stripe.com
                - generic [ref=e185]:
                    - text: Powered by
                    - img "Stripe" [ref=e187]
            - link "Terms" [ref=e190] [cursor=pointer]:
                - /url: https://stripe.com/legal/end-users
            - link "Privacy" [ref=e191] [cursor=pointer]:
                - /url: https://stripe.com/privacy
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  |
  3  | const TENANT = "acme-corp";
  4  | const API = `http://localhost:8000/api/v1/storefront/${TENANT}`;
  5  | const BASE = `http://localhost:3000/${TENANT}`;
  6  |
  7  | test("full storefront purchase loop", async ({ page }) => {
  8  |   // 1. Fetch a real variant ID from the seeded data
  9  |   const productRes = await fetch(`${API}/products?page_size=1`);
  10 |   const productData = await productRes.json();
  11 |   const product = productData.data?.[0];
  12 |   const variantId = product?.variants?.[0]?.id;
  13 |   if (!variantId) throw new Error("No variant found — seed the database first");
  14 |
  15 |   // 2. Browse shop and open a product to verify PLP/PDP rendering
  16 |   await page.goto(`${BASE}/shop/all`);
  17 |   await page.locator('[data-testid="product-card"]').first().click();
  18 |   await page.waitForURL(`**/shop/**`);
  19 |
  20 |   // 3. Verify PDP renders with product info
  21 |   await expect(page.locator('[data-testid="add-to-cart"]').first()).toBeVisible();
  22 |
  23 |   // 4. Create a checkout session directly via API (bypasses legacy cart store)
  24 |   const sessionRes = await fetch(`${API}/checkout/session`, {
  25 |     method: "POST",
  26 |     headers: { "Content-Type": "application/json" },
  27 |     body: JSON.stringify({
  28 |       items: [{ variant_id: variantId, quantity: 2 }],
  29 |       customer_email: "test@example.com",
  30 |     }),
  31 |   });
  32 |   const sessionData = await sessionRes.json();
  33 |   expect(sessionData.session_url).toBeTruthy();
  34 |
  35 |   // 5. Navigate to the Stripe hosted checkout page
  36 |   await page.goto(sessionData.session_url);
  37 |   await page.waitForURL(
  38 |     (url) => url.hostname.includes("stripe.com"),
  39 |     { timeout: 15000 },
  40 |   );
  41 |
  42 |   // 6. Wait for Stripe Checkout page to fully load
> 43 |   await page.waitForLoadState("networkidle", { timeout: 20000 });
     |              ^ TimeoutError: page.waitForLoadState: Timeout 20000ms exceeded.
  44 |
  45 |   // Fill email on the main page (Stripe Checkout renders this outside iframes)
  46 |   const emailField = page.locator('[data-testid="hosted-payment-email"], input[type="email"]').first();
  47 |   await emailField.waitFor({ timeout: 15000 });
  48 |   await emailField.fill("test@example.com");
  49 |
  50 |   // Card fields are in a Stripe iframe — access via frameLocator
  51 |   const stripeFrame = page.frameLocator("iframe[name^='__privateStripeFrame']").first();
  52 |
  53 |   // Fill card number
  54 |   await stripeFrame.locator('[name="cardnumber"]').first().fill("4242424242424242");
  55 |   await stripeFrame.locator('[name="exp-date"]').first().fill("12/30");
  56 |   await stripeFrame.locator('[name="cvc"]').first().fill("123");
  57 |
  58 |   // Submit payment
  59 |   await page.locator('button[type="submit"], [data-testid="hosted-payment-submit"]').first().click();
  60 |
  61 |   // 7. Verify redirect back to storefront success page
  62 |   await page.waitForURL(`**/checkout/success**`, { timeout: 60000 });
  63 |   await expect(
  64 |     page.locator('[data-testid="order-success-title"]'),
  65 |   ).toBeVisible();
  66 | });
  67 |
```
