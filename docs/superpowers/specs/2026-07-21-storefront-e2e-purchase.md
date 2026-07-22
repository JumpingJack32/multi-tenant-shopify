# Storefront E2E Purchase Simulation — Specification

> **Status:** Draft

---

## 1. Value

Verify the complete customer purchase pipeline across the full stack: storefront UI → cart state → Stripe Checkout session → webhook → order creation. Uses a split strategy to avoid DOM fragility with Stripe's hosted page.

---

## 2. Architecture

```
Phase A (Playwright — Storefront UI):
  PLP → PDP → Verify add-to-cart → Call /checkout/session API → Assert session_url

Phase B (Synthetic Webhook — Backend verification):
  Construct signed checkout.session.completed event
  POST to /webhooks/stripe
  Assert order created in DB

Phase C (Optional manual — Full Stripe DOM):
  npx playwright test e2e/purchase-stripe-ui.spec.ts
```

---

## 3. Backend: Richer Seed Data

Extend existing product seeds with realistic `specs` arrays, multiple categories, 2–3 variants per product, Cloudinary demo image URLs. No new model fields needed.

---

## 4. Testing Strategy

**Phase A (Playwright):** Drive the storefront UI up to the point of clicking "Proceed to Payment". Assert that the backend API returns a valid `session_url`.

**Phase B (Synthetic webhook):** Construct a signed `checkout.session.completed` event using `stripe.webhooks.generateTestHeaderString()` and POST it directly to `/api/v1/storefront/webhooks/stripe`. Then verify the order was created by querying the success page.

**Phase C (Manual only):** A separate test file `e2e/purchase-stripe-ui.spec.ts` runs the full Stripe DOM interaction. Not included in CI.

---

## 5. Synthetic Webhook

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia" as any,
});

const payload = JSON.stringify({
  id: `evt_${Date.now()}`,
  type: "checkout.session.completed",
  data: { object: { id: sessionId, metadata: {} } },
});

const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
});

await fetch("http://localhost:8000/api/v1/storefront/webhooks/stripe", {
  method: "POST",
  headers: { "stripe-signature": signature },
  body: payload,
});
```

---

## 6. Files Changed

| File                                    | Change                                              |
| --------------------------------------- | --------------------------------------------------- |
| `e2e/purchase.spec.ts`                  | **Rewrite** — split strategy with synthetic webhook |
| `apps/storefront/package.json`          | Add `@playwright/test`, `stripe`                    |
| Storefront components                   | Add `data-testid` attributes                        |
| `services/backend-api/seed_database.py` | Richer product seeds                                |

---

## 7. Risks & Mitigations

| Risk                                           | Mitigation                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Stripe Checkout DOM changes break browser test | Split strategy — CI uses synthetic webhook only; full DOM test is manual |
| Webhook secret changes                         | Stored in Doppler — injected via CI env vars                             |
| Seed data drifts from schema                   | Seed script is transactional and idempotent                              |
