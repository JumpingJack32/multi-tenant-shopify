# Implementation Plan: Stripe Customer Portal for Guest Accounts

**Branch:** `feat/stripe-customer-portal`

**Spec:** `docs/superpowers/specs/2026-08-07-stripe-customer-portal-guest.md`

**Refinements locked in:**
1. Guest gate = Email + **Order Number** (or shipping zip) verification (Option B)
2. `guest_customer` cookie: `httponly`, `samesite=lax`, `secure`, `max_age=900`
3. Email standardized `lower().strip()`; `stripe_customer_id` persisted on Order/Customer
4. Portal return `?billing=1` → clear cookie + refresh preview + success alert

---

## Step 1 — Portal service (`src/services/portal_service.py`)

- `verify_guest(db, tenant_id, email, order_number=None, shipping_zip=None) -> bool`
  - Email normalized `lower().strip()`
  - Match a PAID order for tenant where email matches AND (order_number OR shipping_zip matches)
- `create_guest_portal_token(email, tenant_id, expires_in_minutes=15) -> str` — signed JWT with `guest_customer` claim
- `parse_guest_portal_token(token) -> dict | None` — verify + expiry check
- `set_guest_cookie(response, token)` — `httponly`, `samesite=lax`, `secure`, `max_age=900`
- `clear_guest_cookie(response)` — delete cookie

**Files:**
- `src/services/portal_service.py` (new)
- Reuse `src/core/security.py` JWT helpers

---

## Step 2 — Persist `stripe_customer_id` on Order/Customer

- Standardize `customer_email.lower().strip()` at checkout entry
- On Stripe checkout `customer` creation, save `stripe_customer_id` to the `Order` (or `Customer` model)
- Migration (if Order lacks the column): `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)`

**Files:**
- `src/orm/models/order.py` (add `stripe_customer_id` if missing)
- `alembic/versions/xxxx_stripe_customer_id.py` (new)
- `src/services/stripe_adapter.py` (set customer id on session create)
- `src/routes/storefront.py` (normalize email at checkout)

---

## Step 3 — Extend portal endpoint + add payment-methods

- `POST /{tenant}/customer-portal`:
  - Optional Clerk identity (via `get_current_user`) → auto-verified, email from Clerk
  - Guest → require `email` + (`order_number` OR `shipping_zip`); verify via `verify_guest`
  - On success: set guest cookie, create portal session, return `{ url, verified: true }`
  - On failure: 403 "Verification failed"
- `GET /{tenant}/payment-methods`:
  - Same verification path (cookie token or Clerk identity)
  - Returns `[{ id, brand, last4, exp_month, exp_year }]` via `adapter.list_payment_methods()`

**Files:**
- `src/routes/storefront.py` (extend)
- `src/orm/schemas/cart.py` (extend `CheckoutIntentRequest` or new `PortalRequest`)

---

## Step 4 — Rebuild account page (`apps/storefront/src/app/[tenant]/account/page.tsx`)

- **Registered user**: Clerk `useUser()` auto-populates email; "Manage Billing" goes straight to portal
- **Guest**: email + order-number (or zip) form; on verify → set cookie, show saved-card preview, launch portal
- **Payment methods preview**: cards showing brand / last4 / expiry
- **`?billing=1` return handling**: clear guest cookie, refresh preview, success toast/alert

**Files:**
- `apps/storefront/src/app/[tenant]/account/page.tsx` (rebuild)
- `apps/storefront/src/components/storefront/account/billing-section.tsx` (new)
- `apps/storefront/src/lib/storefront-api.ts` (add `createCustomerPortal`, `fetchPaymentMethods`)

---

## Step 5 — Stripe dashboard config (manual)

- Enable Customer Portal: payment methods, billing details, invoices

---

## Step 6 — Tests

- **Backend** `tests/test_portal_service.py`:
  - `verify_guest` — matching email+order → True; email-only (no order) → False; cross-tenant → False; zip match
  - token round-trip + expiry
  - cookie flags (httponly/samesite/secure/max_age)
- **Backend** `tests/test_customer_portal.py`:
  - portal 200 (verified guest), 403 (unverified), 401 (no email), tenant isolation
  - payment-methods preview
- **Frontend** `account-page.test.tsx`:
  - guest form renders; registered auto-fill; preview shown; `billing=1` clears cookie + alert

**Files:**
- `services/backend-api/tests/test_portal_service.py` (new)
- `services/backend-api/tests/test_customer_portal.py` (new)
- `apps/storefront/src/app/[tenant]/account/__tests__/account-page.test.tsx` (new)

---

## Execution order

```
Step 1  (portal service)        ─┐
Step 2  (stripe_customer_id)    ─┤  Backend foundation
Step 3  (portal + payment API)  ─┘
Step 4  (account page rebuild)  ───  Frontend
Step 5  (Stripe dashboard)      ───  Config (manual)
Step 6  (tests + verify)        ───  Verification
```
