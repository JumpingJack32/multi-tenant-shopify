# Subscriptions & Recurring Billing — Implementation Plan

**Spec:** Subscriptions & Recurring Billing Engine

---

## Step 1 — Models + Migration

**File:** `src/orm/models/subscription.py`

- `SubscriptionPlan`: tenant_id, product_id, interval (DAY/WEEK/MONTH/YEAR), interval_count, discount_percentage, is_active
- `CustomerSubscription`: tenant_id, customer_id/customer_email, subscription_plan_id, stripe_subscription_id, status (active/past_due/canceled/paused), current_period_end, cancel_at_period_end
- Alembic migration

## Step 2 — Stripe Integration

**File:** `src/services/stripe_adapter.py`

- Extend `CheckoutSessionAdapter.create_checkout()` — if item has `subscription_plan_id`, create a Stripe Recurring Price and `subscription_data` instead of one-time `price_data`

**File:** `src/routes/webhooks.py`
- `invoice.payment_succeeded` → create new Order + OrderItems for the recurring line items
- `invoice.payment_failed` → set CustomerSubscription.status = past_due
- `customer.subscription.deleted` → set status = canceled

## Step 3 — PDP Subscription Selector

**File:** `apps/storefront/src/components/storefront/subscription-selector.tsx`
- Radio toggle: One-time purchase / Subscribe & Save X%
- Interval dropdown when subscription selected
- Passes selected plan ID to checkout flow

## Step 4 — Customer Subscription Portal

**File:** `apps/storefront/src/app/[tenant]/account/subscriptions/page.tsx`
- List active subscriptions with next billing date, status badge
- Pause / Cancel / Change interval actions (via Stripe Customer Portal or direct API)

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
