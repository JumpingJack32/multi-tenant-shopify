# Storefront E2E Purchase Simulation — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-21-storefront-e2e-purchase.md`

---

## Step 1 — Install Stripe SDK (Node.js)

```bash
cd apps/storefront && pnpm add stripe
```

The Python SDK is already installed. The Node.js `stripe` package is needed for `generateTestHeaderString()`.

---

## Step 2 — Rewrite E2E Test

**File:** `apps/storefront/e2e/purchase.spec.ts`

- Phase A: PLP → PDP → API call to `/checkout/session` → assert `session_id`
- Phase B: Construct signed `checkout.session.completed` event, POST to webhook
- Phase C: Navigate to success page, assert order confirmation visible

---

## Step 3 — Run & Verify

```bash
# Ensure backend, stripe listen, and storefront are running
lsof -ti:8000 | xargs kill -9; lsof -ti:3000 | xargs kill -9

# Start backend
cd services/backend-api && nohup doppler run -- uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 &

# Start stripe listen
nohup stripe listen --forward-to localhost:8000/api/v1/storefront/webhooks/stripe &

# Start storefront
cd apps/storefront && NEXT_PUBLIC_API_URL=http://localhost:8000 pnpm dev --port 3000 &

# Run test
cd apps/storefront && NEXT_PUBLIC_API_URL=http://localhost:8000 npx playwright test e2e/purchase.spec.ts --reporter=list
```
