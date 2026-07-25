# Transactional Email Notifications — Implementation Plan

**Context:** Trigger order confirmation and shipping notification emails via existing Resend + Jinja2 pipeline.

---

## Step 1 — Jinja2 Email Templates

**Files:** `src/templates/email/order_confirmation.html`, `src/templates/email/shipping_notification.html`

- Follow the existing `abandoned_cart.html` pattern (inline styles, Jinja2 tokens)
- `order_confirmation.html` — order number, line items with variant labels, quantities, prices, total, shipping address, link to storefront order page
- `shipping_notification.html` — order number, carrier, tracking number, tracking URL link, fulfilled items list

---

## Step 2 — Email Service Helpers

**File:** `src/services/email_service.py`

- `send_order_confirmation(order, tenant)` — renders `order_confirmation.html` with order data, dispatches via `send_raw()`
- `send_shipping_notification(fulfillment, order, tenant)` — renders `shipping_notification.html`, dispatches via `send_raw()`
- Both functions fire in background via `BackgroundTasks` or `asyncio.create_task` to avoid blocking the API response

---

## Step 3 — Order Confirmation Trigger

**File:** `src/routes/storefront.py` (checkout handler)

- After successful checkout (`POST /carts/{cart_id}/checkout`), call `send_order_confirmation(order, tenant)` in background
- Email only sends if `order.customer_email` is set

---

## Step 4 — Shipping Notification Trigger

**File:** `src/services/fulfillment_service.py`

- After successful `create_fulfillment()`, if the request includes `notify_customer=True`, call `send_shipping_notification(fulfillment, order, tenant)` in background

---

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit
cd apps/admin && pnpm tsc --noEmit
```
