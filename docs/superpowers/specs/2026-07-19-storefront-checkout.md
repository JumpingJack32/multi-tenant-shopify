# Storefront Checkout Specification (Phase 1 — Unified Stripe Loop)

> **Status:** Proposed Spec

---

## 1. Value

Close the purchase loop. Users can browse products → add to cart → enter shipping info → pay with card → see order confirmation. Built with Stripe Elements (single account, POC), guest checkout, and tamper-proof server-side price verification.

---

## 2. Architecture

```
[ Cart Drawer ] ──(Click Checkout)──> [ /[tenant]/checkout ]
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                │  CheckoutForm (client, ssr: false)                        │
                │  1. Mount → POST /checkout/intent with cart items         │
                │  2. Stripe refetches DB prices, creates PaymentIntent     │
                │  3. Returns { clientSecret, amount, currency }            │
                └─────────────────────────────┬─────────────────────────────┘
                                              │
                ┌─────────────────────────────┴─────────────────────────────┐
                │  <Elements stripe={stripePromise} options={{ clientSecret }}> │
                │    <PaymentElement />                                     │
                │    User submits → stripe.confirmPayment()                 │
                └─────────────────────────────┬─────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │  Success → POST /orders                           │
                    │  Payload: { payment_intent_id, customer_email,     │
                    │             shipping_address }                     │
                    │  → clear cart → redirect /checkout/success        │
                    └───────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │  Stripe Webhook → POST /webhooks/stripe           │
                    │  Listens: payment_intent.succeeded / .payment_failed │
                    │  → atomic state transition PENDING_PAYMENT → PAID │
                    └───────────────────────────────────────────────────┘
```

---

## 3. Environment & Configuration

### Backend (`services/backend-api/src/config/settings.py`)

```python
stripe_secret_key: Optional[str] = None
stripe_webhook_secret: Optional[str] = None
```

Both injected via Doppler — no `.env` files. Gated: if `stripe_secret_key` is `None`, checkout endpoints return 503.

### Frontend (`apps/storefront`)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Injected via Doppler during `pnpm dev`.

---

## 4. Backend & Data Layer Changes

### Order Model (`services/backend-api/src/orm/models/order.py`)

```python
customer_email: str = Field(index=True, nullable=False)
stripe_payment_intent_id: Optional[str] = Field(default=None, index=True, unique=True)
stripe_client_secret: Optional[str] = Field(default=None)
```

### Order Status Transitions

```
PENDING_PAYMENT → PAYMENT_PROCESSING → PAID
                                       → PAYMENT_FAILED (on webhook failure event)
```

### Migration

```bash
cd services/backend-api
PYTHONPATH=. doppler run -- uv run alembic revision --autogenerate -m "add order stripe fields"
PYTHONPATH=. doppler run -- uv run alembic upgrade head
```

---

## 5. API Endpoints

All mounted on the storefront router at `/api/v1/storefront/`.

### `POST /{tenant_slug}/checkout/intent`

**Payload:**

```json
{
  "items": [{ "variant_id": "uuid", "quantity": 1 }],
  "customer_email": "buyer@example.com"
}
```

**Tamper-proof flow:**

1. Extract `variant_id`s from payload
2. Query DB for current variant prices in tenant's base currency
3. Calculate total server-side (never trust client-side price)
4. **Scaffold order** in `PENDING_PAYMENT` state with `stripe_payment_intent_id` set to the intent ID that will be created
5. Create Stripe `PaymentIntent` with `amount` in cents, `currency`, metadata `{ tenant: tenant_slug }`
6. Update order with `stripe_client_secret`
7. Return `{ clientSecret, amount, currency }`

Scaffolding the order early prevents the client/webhook race condition — both paths converge on the same locked row.

**Returns:**

```json
{ "clientSecret": "pi_..._secret_...", "amount": 45000, "currency": "gbp" }
```

### `finalize_successful_order(payment_intent_id)` (shared internal service)

Both `POST /orders` and the webhook call this same idempotent function:

```
1. SELECT FOR UPDATE on Order WHERE stripe_payment_intent_id = :pid
2. If order.status == "PAID" → return (noop — already processed)
3. If order.status == "PENDING_PAYMENT" → atomically:
   a. Deduct inventory
   b. Set status to "PAID"
   c. Commit and release lock
```

### `POST /{tenant_slug}/orders`

**Payload:**

```json
{
  "payment_intent_id": "pi_...",
  "customer_email": "buyer@example.com",
  "shipping_address": {
    "line1": "123 Street",
    "city": "London",
    "postal_code": "SW1A 1AA",
    "country": "GB"
  }
}
```

**Flow:**

1. Verify `payment_intent_id` status with Stripe API
2. If `succeeded`: call `finalize_successful_order(payment_intent_id)`
3. If not succeeded: return 402

### `POST /webhooks/stripe`

**Authentication:** Validates signature via `stripe_webhook_secret`.

**Events handled:**

- `payment_intent.succeeded` → call `finalize_successful_order(payment_intent_id)`
- `payment_intent.payment_failed` → transition order to `PAYMENT_FAILED`

The webhook exists from day one, even though Phase 1 card payments succeed synchronously. This prevents painful refactoring when async payment methods (BNPL, bank transfers) are added later.

---

## 6. Frontend Component Layout

### Routes

```
/[tenant]/checkout/page.tsx              → SSR-safe parent, dynamic import
/[tenant]/checkout/success/page.tsx      → Order confirmation page
```

### `/[tenant]/checkout/page.tsx`

```tsx
import dynamic from "next/dynamic";

const CheckoutFormClient = dynamic(
  () => import("@/components/storefront/checkout-form"),
  { ssr: false },
);

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return <CheckoutFormClient tenantSlug={tenant} />;
}
```

### `CheckoutForm` (new)

**File:** `apps/storefront/src/components/storefront/checkout-form.tsx` (`"use client"`)

```tsx
interface CheckoutFormProps {
  tenantSlug: string;
}
```

**Behavior:**

1. On mount: calls `POST /checkout/intent` with `cart.items` → receives `clientSecret`
2. Renders `<Elements stripe={stripePromise} options={{ clientSecret, appearance: darkTheme }}>`
3. Inner `<EmbeddedFormSheet>` uses `useStripe()` and `useElements()`
4. On submit:
   - `stripe.confirmPayment({ elements, redirect: "if_required" })`
   - On success: POST `/orders` → clear cart → redirect `/checkout/success`
   - On failure: show error, reset submitting state
5. Two-column layout: left (form) / right (order summary)

### `CheckoutSummary`

Renders line items from `useCart`, monospaced prices, divider lines, total.

### Dark Theme for Stripe Elements

```ts
const darkTheme = {
  variables: {
    colorPrimary: "#ffffff",
    colorBackground: "#000000",
    colorText: "#ffffff",
    fontFamily: "Inter, sans-serif",
  },
};
```

---

## 7. Edge Cases & Safety Guards

| Risk                                               | Mitigation                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client sends tampered price                        | Backend refetches all variant prices from DB — client price values are ignored                                                                                                                                 |
| Double-submit race condition                       | Button disabled + `isSubmitting` state on click, reset only on success or explicit error                                                                                                                       |
| Stale cart (price changed mid-session)             | `/checkout/intent` recalculates — if total differs from client expectation, no error; user sees correct total at payment step                                                                                  |
| Guest without account                              | `customer_email` is mandatory on the form — no auth required                                                                                                                                                   |
| SSR hydration from Stripe Elements                 | Parent page uses `dynamic(..., { ssr: false })`                                                                                                                                                                |
| Stripe keys not configured                         | Backend returns 503; frontend shows "Checkout unavailable"                                                                                                                                                     |
| Inventory sold out between add-to-cart and payment | `/checkout/intent` verifies stock; returns 409 if insufficient                                                                                                                                                 |
| Async payment method succeeds after redirect       | Webhook handler processes `payment_intent.succeeded` to finalize order                                                                                                                                         |
| **Client/Webhook fulfillment race**                | Order scaffolded as `PENDING_PAYMENT` at intent-creation time. Both client and webhook call `finalize_successful_order()` with `SELECT FOR UPDATE` + idempotent status check — inventory deducted exactly once |

---

## 8. Files Changed

| File                                                             | Change                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `services/backend-api/src/orm/models/order.py`                   | Add `customer_email`, `stripe_payment_intent_id`, `stripe_client_secret` |
| `services/backend-api/src/routes/storefront.py`                  | Add `/checkout/intent`, `/orders`, `/webhooks/stripe` endpoints          |
| `services/backend-api/src/config/settings.py`                    | Add `stripe_secret_key`, `stripe_webhook_secret`                         |
| `services/backend-api/alembic/versions/...`                      | **New** migration                                                        |
| `apps/storefront/src/app/[tenant]/checkout/page.tsx`             | **New** — SSR-safe page with dynamic import                              |
| `apps/storefront/src/app/[tenant]/checkout/success/page.tsx`     | **New** — confirmation page                                              |
| `apps/storefront/src/components/storefront/checkout-form.tsx`    | **New** — core payment orchestration                                     |
| `apps/storefront/src/components/storefront/checkout-summary.tsx` | **New** — order summary sidebar                                          |
