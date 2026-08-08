# Stripe Customer Portal for Guest Accounts

**Goal:** Turn the existing minimal "Manage Billing" flow into a full self-serve customer portal for both registered users and **guest checkout customers**, letting them manage payment methods, billing addresses, and invoices without admin/support intervention.

---

## 1. Existing Foundation

- **`POST /api/v1/storefront/{tenant}/customer-portal`** (`src/routes/storefront.py:1001`) — accepts `CheckoutIntentRequest`, verifies the email has a PAID/PENDING order for the tenant, then calls the adapter to create a Stripe Billing Portal session. Redirects to Stripe's hosted portal.
- **`StripeAdapter.create_customer_portal_session()`** (`src/services/stripe_adapter.py:324`) — searches/creates a Stripe Customer by `email + metadata['tenant_id']`, creates a `billing_portal.Session`, returns the URL.
- **`StripeAdapter.list_payment_methods()`** (`:353`) — lists saved cards for a customer.
- **Account page** (`apps/storefront/src/app/[tenant]/account/page.tsx`) — bare email input + "Manage Billing" button.

**Gaps:**

| Gap | Impact |
|-----|--------|
| Guest must type their email manually every time | Friction; no session memory |
| Email-only verification is weak | Anyone who knows/guesses the email could open a portal session |
| No saved-payment-methods preview before entering Stripe | Users don't know what they'll manage |
| No "remember me" / guest identity cookie | Re-entry required per visit |
| No tests for the portal flow | Regression risk |

---

## 2. Design Decisions

1. **Guest identity via signed email token (not full auth).** Keep guest checkout frictionless — no password. A short-lived signed JWT (`guest_customer` claim) proves email ownership after the guest enters it + confirms via an order-based secret, OR via the existing order-confirmation email link.
2. **Tiered verification:**
   - **Registered user** (Clerk session) → verified automatically, no email prompt.
   - **Guest with recent order** → email prompt, verified by matching a completed order; portal session is short-lived.
   - **Guest with no order** → 403 (cannot create portal without a purchase — prevents abuse).
3. **Reuse the existing Stripe Billing Portal** for actual card/billing management (Stripe-hosted, PCI-compliant). The portal URL is returned after verification.
4. **Add a saved-payment-methods preview** on the account page (brand, last4, expiry) before launching the full portal.

---

## 3. Backend changes

### 3a. Guest verification service (`src/services/portal_service.py`, new)

```python
async def verify_guest_email(
    db: AsyncSession,
    tenant_id: UUID,
    email: str,
) -> bool:
    """A guest is verified if they have a PAID order for this tenant."""
    # SELECT 1 FROM orders WHERE tenant_id=:tid AND customer_email=:email
    #   AND status IN ('paid') LIMIT 1
    ...


def create_guest_portal_token(
    email: str,
    tenant_id: UUID,
    expires_in_minutes: int = 15,
) -> str:
    """Signed JWT with claim guest_customer=email. Short-lived."""
    ...
```

### 3b. Portal session creation (extend `storefront.py`)

- Accept `email` (guest) OR Clerk identity (registered).
- **Registered user:** use Clerk `email` from `get_current_user` (new optional dependency), skip email prompt.
- **Guest:** verify via `verify_guest_email`, then create a short-lived token.
- Return `{ url, verified: bool }` (url only when verified).

### 3c. Payment methods preview (`GET /{tenant}/payment-methods`)

- Same verification as portal.
- Returns `[{ id, brand, last4, exp_month, exp_year }]` via `adapter.list_payment_methods()`.

### 3d. Guest identity cookie

- After a successful guest verification, set a signed cookie (`guest_customer=<jwt>`) scoped to the tenant so the account page auto-recognizes the guest on return visits.

---

## 4. Frontend changes

### 4a. Account page (`apps/storefront/src/app/[tenant]/account/page.tsx`)

- **Registered user:** auto-populate email from Clerk session (`useUser`); "Manage Billing" goes straight to portal.
- **Guest:** email input + verification. On success:
  - Store `guest_customer` cookie.
  - Show saved-payment-methods preview.
  - "Manage Billing" launches the Stripe portal.
- Show the preview list (brand / last4 / expiry) with a link to the full portal.

### 4b. Portal callback

- Stripe portal `return_url` → `/{tenant}/account?billing=1` → toast "Billing updated".

---

## 5. Stripe configuration (dashboard, no code)

- Enable **Customer Portal** in Stripe dashboard (allow: payment methods, billing details, invoices).
- Ensure the portal feature is configured for the account.

---

## 6. Security

- **Verification gate:** portal + payment-methods endpoints require a PAID order for the email (existing) AND (for guests) a signed token or immediate verification. Registered users bypass via Clerk identity.
- **Short-lived tokens:** guest portal token expires in 15 min.
- **Tenant isolation:** all Stripe Customer lookups scoped by `metadata['tenant_id']`.
- **Rate limit:** reuse `throttle_checkout` on the portal endpoint.

---

## 7. Tests

- **Backend:**
  - `test_portal_service.py` — `verify_guest_email` (paid order → True, no order → False, cross-tenant → False), `create_guest_portal_token` round-trip + expiry.
  - `test_customer_portal.py` — portal session 200 (guest with order), 403 (guest without order), payment-methods preview, tenant isolation.
- **Frontend:**
  - `account-page.test.tsx` — renders email form for guest, auto-populates for registered user, shows payment-methods preview, handles 403 gracefully.

---

## 8. Execution order

1. `portal_service.py` — guest verification + signed token
2. Backend: extend `POST /customer-portal`, add `GET /payment-methods`, guest cookie
3. Frontend: rebuild account page (registered auto-fill, guest flow, preview)
4. Stripe dashboard: enable portal features
5. Tests + verification

---

## 9. Key decisions (summary)

- **Guests stay auth-free** (no passwords) — email + order-verification gate.
- **Stripe Billing Portal** handles all actual card/billing management (PCI-compliant, no custom PCI surface).
- **Tiered verification:** Clerk identity > guest-with-order > deny.
- **Short-lived signed tokens** + tenant-scoped customer metadata.
- **Preview saved cards** on the account page for transparency before entering Stripe.
