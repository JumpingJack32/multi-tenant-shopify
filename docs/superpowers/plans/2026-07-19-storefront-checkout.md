# Storefront Checkout — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-19-storefront-checkout.md`

---

## Step 1 — Backend Schema & Secret Injection

### 1a — Add Stripe settings

**File:** `services/backend-api/src/config/settings.py`

```python
stripe_secret_key: Optional[str] = None
stripe_webhook_secret: Optional[str] = None
```

### 1b — Add fields to Order model

**File:** `services/backend-api/src/orm/models/order.py`

```python
customer_email: str = Field(index=True, nullable=False)
stripe_payment_intent_id: Optional[str] = Field(default=None, index=True, unique=True)
stripe_client_secret: Optional[str] = Field(default=None)
```

### 1c — Generate and run migration

```bash
cd services/backend-api
PYTHONPATH=. doppler run -- uv run alembic revision --autogenerate -m "add order stripe fields"
PYTHONPATH=. doppler run -- uv run alembic upgrade head
```

---

## Step 2 — Idempotent Service & Endpoints

### 2a — Install Stripe SDK

```bash
cd services/backend-api && uv add stripe
```

### 2b — Implement `finalize_successful_order` service

**File:** `services/backend-api/src/services/order_service.py` (new or extend)

```
def finalize_successful_order(payment_intent_id: str) -> Order:
    SELECT ... FOR UPDATE on Order WHERE stripe_payment_intent_id = :pid
    if order.status == "PAID": return order  # idempotent noop
    deduct inventory atomically
    set order.status = "PAID"
    commit
    return order
```

### 2c — Add checkout endpoints to storefront router

**File:** `services/backend-api/src/routes/storefront.py`

- `POST /{tenant_slug}/checkout/intent` — server-side price calc, scaffold Order as PENDING_PAYMENT, create PaymentIntent, return clientSecret
- `POST /{tenant_slug}/orders` — verify intent status, call `finalize_successful_order`
- `POST /webhooks/stripe` — validate webhook signature, call `finalize_successful_order` on `payment_intent.succeeded`

---

## Step 3 — Frontend Components

### 3a — Install Stripe JS SDK

```bash
cd apps/storefront && pnpm add @stripe/stripe-js @stripe/react-stripe-js
```

### 3b — Checkout parent page

**File:** `apps/storefront/src/app/[tenant]/checkout/page.tsx`

Dynamic import with `ssr: false`.

### 3c — CheckoutForm

**File:** `apps/storefront/src/components/storefront/checkout-form.tsx`

Calls `/checkout/intent` on mount, wraps `<Elements>`, renders `<PaymentElement>`, handles submit with `confirmPayment`, POSTs to `/orders`, redirects to success.

### 3d — Success page

**File:** `apps/storefront/src/app/[tenant]/checkout/success/page.tsx`

Order confirmation with order number, email confirmation note.

---

## Step 4 — Verify

```bash
# Backend
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q

# Frontend types
pnpm --filter storefront exec tsc --noEmit

# Full test suite
pnpm vitest run
```
