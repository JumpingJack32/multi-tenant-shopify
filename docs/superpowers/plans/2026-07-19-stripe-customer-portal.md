# Stripe Customer Portal — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-19-stripe-customer-portal.md`

---

## Step 1 — Refactor Adapter with `anyio.to_thread.run_sync`

**File:** `services/backend-api/src/services/stripe_adapter.py`

- Wrap all `stripe.*.create()` / `stripe.*.search()` / `stripe.Webhook.construct_event()` calls in `anyio.to_thread.run_sync(_sync_function)` across all adapter methods (`create_checkout`, `handle_event`, `create_customer_portal_session`).
- Implement `create_customer_portal_session` using `stripe.Customer.search()` with metadata query.

---

## Step 2 — Add Portal Endpoint

**File:** `services/backend-api/src/routes/storefront.py`

- Add `POST /{tenant_slug}/customer-portal` with a Pydantic request schema.
- Verify request email has a paid/pending order under this tenant before issuing portal session.
- Return `{ "url": "https://..." }`.

---

## Step 3 — Account Page with Billing Button

**File:** `apps/storefront/src/app/[tenant]/account/page.tsx` (new)

- Simple page with "Manage Billing & Payment Methods" button.
- On click: POST to `/customer-portal`, redirect to Stripe on success, show error on failure.
- try/finally for loading state.

---

## Step 4 — Verify

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q
pnpm --filter storefront exec tsc --noEmit
pnpm vitest run
```
