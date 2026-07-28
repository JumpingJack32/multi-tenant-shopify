# Implementation Plan: Phase 3 — Commercial SaaS Layer & Merchant Onboarding

**Branch:** `feat/saas-layer`

---

## Step 1 — Set up Stripe SaaS products & Doppler configs

- Create 3 Stripe products + price IDs (monthly + yearly) via Stripe dashboard or seed script
- Add Stripe price IDs to Doppler: `STRIPE_SAAS_STARTER_MONTHLY`, `STRIPE_SAAS_STARTER_YEARLY`, etc.
- Ensure `STRIPE_API_KEY` is present (already set)

**Files:**
- Doppler config (no code change)
- Optionally: `scripts/create_stripe_saas_products.py` for reproducibility

---

## Step 2 — `SaaSPlan` model + migration + seed

- Create `SaaSPlan` model at `services/backend-api/src/orm/models/saas_plan.py`
- Register in `services/backend-api/src/orm/models/__init__.py`
- Run migration via Alembic (`op.execute("CREATE TABLE saas_plans ...")`)
- Seed 3 plans in `seed_database.py` + standalone in `seed_showcase.py`
- Add Pydantic schemas at `services/backend-api/src/orm/schemas/saas_plan.py`

**Files:**
- `src/orm/models/saas_plan.py` (new)
- `src/orm/models/__init__.py` (add import)
- `src/orm/schemas/saas_plan.py` (new)
- `alembic/versions/xxxx_add_saas_plans.py` (new)
- `scripts/seed_database.py` (add plans to seed)
- `scripts/seed_showcase.py` (add plans to seed)

---

## Step 3 — `GET /api/v1/public/plans` endpoint

- Create `services/backend-api/src/routes/public.py` with a new `public_router`
- Mount at `/api/v1/public` in `main.py`
- Endpoint: `GET /plans` — returns public SaaS plans filtered by `is_public=True`
- No auth required, no tenant required

**Files:**
- `src/routes/public.py` (new)
- `src/main.py` (mount router)
- `tests/test_public_plans.py` (new)

---

## Step 4 — `POST /api/v1/public/tenants` + `POST /check-slug` endpoints

- Create `services/backend-api/src/routes/signup.py` or add to `public.py`
- `POST /api/v1/public/tenants/check-slug` — validates subdomain availability
- `POST /api/v1/public/tenants` — creates tenant, TenantUser, Stripe customer + subscription

**Backend logic for `POST /tenants`:**
1. Validate slug (alphanumeric + hyphens, 3-30 chars)
2. Check slug uniqueness
3. Validate plan slug exists
4. Create Clerk user via Clerk API (or use Clerk session `userId` from header)
5. Create Tenant with `status=active`, `plan=plan_slug`, `trial_ends_at=NOW()+14d`
6. Create TenantUser with `clerk_user_id`, `role=owner`
7. Stripe: create Customer, attach payment method, create subscription with trial
8. Return tenant slug + admin redirect URL

**Files:**
- `src/routes/public.py` (add endpoints)
- `src/services/saas_service.py` (new — sign-up orchestration)
- `src/services/stripe_adapter.py` (add SaaS subscription methods)
- `tests/test_saas_signup.py` (new)

---

## Step 5 — Frontend: route group + marketing layout

- Create `apps/storefront/src/app/(marketing)/layout.tsx` — marketing header (logo, Pricing, Log In), footer
- Create `apps/storefront/src/app/(marketing)/page.tsx` — landing page (hero, features, showcase, pricing preview, CTA)
- Update `apps/storefront/src/middleware.ts` (or `proxy.ts`) to allow public routes

**Files:**
- `apps/storefront/src/app/(marketing)/layout.tsx` (new)
- `apps/storefront/src/app/(marketing)/page.tsx` (new)
- `apps/storefront/src/middleware.ts` (add public passthroughs)
- `apps/storefront/src/components/marketing/hero.tsx` (new)
- `apps/storefront/src/components/marketing/feature-grid.tsx` (new)
- `apps/storefront/src/components/marketing/footer.tsx` (new)

---

## Step 6 — Pricing matrix component

- Create `apps/storefront/src/components/marketing/pricing-matrix.tsx`
- Fetches `GET /api/v1/public/plans`
- Monthly/annual toggle with 20% annual discount
- 3 plan cards with feature lists and CTA buttons
- Optional: standalone pricing page at `/(marketing)/pricing/page.tsx`

**Files:**
- `apps/storefront/src/components/marketing/pricing-matrix.tsx` (new)
- `apps/storefront/src/app/(marketing)/pricing/page.tsx` (new)

---

## Step 7 — Onboarding wizard: Step 1 (store info + Clerk sign-up)

- Create `apps/storefront/src/app/(marketing)/signup/page.tsx`
- Embed Clerk `<SignUp />` component
- Add store name + subdomain input fields
- Client-side slug availability check (debounced)
- On success: store chosen plan in URL query or localStorage, redirect to `/signup/plan`

**Files:**
- `apps/storefront/src/app/(marketing)/signup/page.tsx` (new)
- `apps/storefront/src/components/marketing/signup-form.tsx` (new)

---

## Step 8 — Onboarding wizard: Step 2 (plan selection + Stripe)

- Create `apps/storefront/src/app/(marketing)/signup/plan/page.tsx`
- Fetches plans from API, shows pricing cards
- Stripe Elements `<PaymentElement />` for card collection
- Calls SetupIntent → confirms payment method → calls `POST /api/v1/public/tenants`
- On success: redirect to `/signup/welcome`

**Files:**
- `apps/storefront/src/app/(marketing)/signup/plan/page.tsx` (new)
- `apps/storefront/src/components/marketing/plan-selector.tsx` (new)

---

## Step 9 — Onboarding wizard: Step 3 (welcome + admin redirect)

- Create `apps/storefront/src/app/(marketing)/signup/welcome/page.tsx`
- Animated countdown (5s) with confetti effect
- Fetches `GET /api/v1/tenants/me` to get admin URL
- Auto-redirects to admin dashboard

**Files:**
- `apps/storefront/src/app/(marketing)/signup/welcome/page.tsx` (new)

---

## Step 10 — E2E flow test

- Manual verification: landing → pricing → sign-up → plan select → provision → admin redirect
- Backend test: `test_saas_signup.py` covers sign-up endpoint, slug check, Stripe integration (with mocked Stripe)
- Frontend test: component tests for pricing matrix, signup form

**Files:**
- `services/backend-api/tests/test_saas_signup.py` (new)
- `apps/storefront/src/components/marketing/__tests__/pricing-matrix.test.tsx` (new)

---

## Execution order

```
Step 1  (Stripe config)         ─┐
Step 2  (SaaSPlan model)        ─┤  Backend foundation
Step 3  (GET /plans endpoint)   ─┘
Step 4  (POST /tenants)         ───  Backend sign-up
Step 5  (Marketing layout)      ─┐
Step 6  (Pricing matrix)        ─┤  Frontend pages
Step 7  (Sign-up step 1)        ─┤
Step 8  (Sign-up step 2)        ─┤
Step 9  (Sign-up step 3)        ─┘
Step 10 (E2E tests)             ───  Verification
```
