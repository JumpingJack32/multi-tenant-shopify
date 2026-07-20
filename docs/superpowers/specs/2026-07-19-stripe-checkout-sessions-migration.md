# Stripe Checkout Sessions Migration & Customer Portal — Architectural Plan

> **Status:** Proposed
> **Context:** The Stripe best practices skill recommends Checkout Sessions over raw
> PaymentIntent + Elements for one-time payments. This doc outlines the migration
> path using the Adapter Pattern to swap implementations without breaking the
> application, plus a future Customer Portal integration.

---

## 1. Why Checkout Sessions?

| Concern               | PaymentIntent + Elements (current)        | Checkout Sessions (target)                             |
| --------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Payment UI            | Custom React form, our responsibility     | Stripe-hosted, no UI code                              |
| SCA / 3D Secure       | Manual handling                           | Automatic                                              |
| Line-item calculation | Custom server-side                        | Stripe calculates from `line_items`                    |
| Webhook events        | Custom `payment_intent.succeeded`         | Same, plus `checkout.session.completed`                |
| Saved payment methods | Requires SetupIntents                     | Built-in via `mode: "payment"` + `save_payment_method` |
| Customer Portal       | Not possible without `customer` parameter | Native integration                                     |

---

## 2. Adapter Pattern Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CheckoutService                       │
│  (core business logic — price calc, order scaffold,     │
│   inventory lock, order finalization)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                 StripeAdapter (interface)                │
│  + createCheckoutSession(items, customer) → URL         │
│  + handleWebhookEvent(event) → order_id                 │
│  + createCustomerPortalLink(customer_id) → URL          │
├─────────────────────────┬───────────────────────────────┤
│  PaymentIntentAdapter   │  CheckoutSessionAdapter       │
│  (current)              │  (target)                     │
│  - POST /checkout/intent│  - POST /checkout/session     │
│  - stripe.PaymentIntent │  - stripe.checkout.Session    │
└─────────────────────────┴───────────────────────────────┘
```

### Current path (PaymentIntentAdapter):

```
cart → POST /checkout/intent → PaymentIntent → client_secret
  → frontend Elements → confirmPayment → POST /orders → webhook
```

### Target path (CheckoutSessionAdapter):

```
cart → POST /checkout/session → CheckoutSession.url
  → redirect to Stripe → user completes payment
  → Stripe redirects to /checkout/success
  → webhook `checkout.session.completed` → finalize order
```

---

## 3. Implementation Strategy

### Step 1 — Define the Adapter Interface

```python
# src/services/stripe_adapter.py

class StripeAdapter(ABC):
    @abstractmethod
    async def create_checkout(
        self, items: list, customer_email: str, tenant_slug: str
    ) -> CheckoutResult:
        """Return checkout URL or client_secret depending on adapter."""
        ...

    @abstractmethod
    async def handle_event(self, event: dict) -> str | None:
        """Process a Stripe webhook event. Returns order_id if finalized."""
        ...

    @abstractmethod
    async def create_customer_portal_link(
        self, customer_email: str, return_url: str
    ) -> str:
        """Generate a Stripe Customer Portal session URL."""
        ...
```

### Step 2 — Implement Both Adapters

- `PaymentIntentAdapter` — wraps existing `/checkout/intent` logic
- `CheckoutSessionAdapter` — creates `stripe.checkout.Session.create()`, returns URL

### Step 3 — Swap via Config

```python
# In settings.py or service factory
def get_stripe_adapter() -> StripeAdapter:
    if settings.use_checkout_sessions:
        return CheckoutSessionAdapter()
    return PaymentIntentAdapter()
```

Zero-touch swap — no route code changes needed.

---

## 4. Stripe Customer Portal

Once Checkout Sessions is active, Customer Portal is almost free:

```python
async def create_customer_portal_link(
    self, customer_email: str, return_url: str
) -> str:
    customers = stripe.Customer.list(email=customer_email, limit=1)
    if not customers.data:
        customer = stripe.Customer.create(email=customer_email)
    else:
        customer = customers.data[0]

    session = stripe.billing_portal.Session.create(
        customer=customer.id,
        return_url=return_url,
    )
    return session.url
```

This lets customers manage saved cards, update billing info, and view invoice history — all hosted by Stripe, zero frontend work.

---

## 5. Migration Safety

| Risk                                       | Mitigation                                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Existing in-flight PaymentIntents orphaned | Adapter swap only affects new checkouts; in-flight intents complete via existing webhook |
| Checkout Session URL changes frontend flow | Frontend checks adapter response — if `url` present, `window.location.href = url`        |
| Customer Portal requires `stripe.Customer` | Create customer on first checkout if not exists                                          |
