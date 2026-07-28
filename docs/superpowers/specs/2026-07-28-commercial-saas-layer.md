# Phase 3 — Commercial SaaS Layer & Merchant Onboarding

**Goal:** Turn the multi-tenant engine into a commercial SaaS product with a high-converting marketing landing page, interactive pricing tier matrix with Stripe billing, and a 3-step self-serve merchant onboarding wizard.

---

## 1. Existing Foundation

The codebase already has:

- **`Tenant` model** (`src/orm/models/tenant.py`) — `id`, `tenant_id`, `name`, `slug`, `domain`, `plan` (string), `status` (enum), `settings` (JSON), `trial_ends_at`, `subscription_id`. Supports `pending`/`active`/`suspended`/`cancelled` states.
- **`TenantUser` model** — links `clerk_user_id` to`tenant_id` with `role` (owner/admin/staff).
- **ClerkProvider** — wired in the root layout. `proxy.ts` allows all `/:tenant(.*)` routes through.
- **`SubscriptionPlan` model** (`src/orm/models/subscription.py`) — `product_id` FK, `interval`, `interval_count`, `discount_percentage`. This is for **customer-facing product subscriptions** (subscribe-and-save), not SaaS plans. Will reuse only as a conceptual pattern.
- **Tenant CRUD** — `GET/POST/PUT/DELETE /api/v1/tenants/` at `src/routes/tenants.py`.
- **`POST /api/generate`** — Ollama-based AI text generation exists.
- **Root landing page** (`apps/storefront/src/app/page.tsx`) — currently a hard-coded pet-store ("Cats & Dogs") placeholder.
- **Design system** (`DESIGN.md`) — monochrome/editorial-luxury aesthetic. Header sticky with `backdrop-blur-sm`, buttons `rounded-md`, cards `shadow-sm`.

**Gaps:**

| Area | Status |
|------|--------|
| SaaS landing page (`/`) | Occupied by pet-store placeholder. Needs replacement. |
| Sign-up / registration page | Does not exist. |
| SaaS plan / tier model | `Tenant.plan` is a plain string. No `SaaSPlan` model with features/pricing. |
| Tenant self-signup API | Admin-only raw insert. No self-service flow. |
| Onboarding wizard | Does not exist. |
| Public API routes for sign-up | `/api/v1/public/tenants` does not exist. |

---

## 2. New Models & Migrations

### SaaSPlan — billing tiers

```python
class SaaSPlan(BaseModel, table=True):
    __tablename__ = "saas_plans"

    name: str                       # "Starter", "Pro", "Enterprise"
    slug: str                       # "starter", "pro", "enterprise"
    description: Optional[str]
    price_cents_monthly: int        # 4900, 14900, 39900
    price_cents_yearly: int         # 47000, 143000, 383000
    trial_days: int = 14
    sort_order: int = 0
    is_public: bool = True
    features: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    stripe_price_id_monthly: Optional[str]
    stripe_price_id_yearly: Optional[str]
```

**Migration:** Raw SQL `CREATE TABLE saas_plans` with above columns. Unique on `slug`. Seed 3 plans matching the pricing matrix below.

No changes to the `Tenant` model — `plan` (string) and `subscription_id` (nullable Stripe sub ID) fields already exist.

---

## 3. API Endpoints

### Public (unauthenticated, no tenant required)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/public/plans` | List public SaaS plans with features & pricing |
| `POST` | `/api/v1/public/tenants` | Self-serve tenant sign-up (name, slug, email, plan) |
| `POST` | `/api/v1/public/tenants/check-slug` | Validate subdomain availability |

### Authenticated (Clerk session)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/tenants/me` | Get current user's tenant (for admin redirect) |

### `POST /api/v1/public/tenants` — Sign-up payload

```json
{
  "name": "My Store",
  "slug": "mystore",
  "email": "owner@example.com",
  "plan_slug": "pro",
  "stripe_payment_method_id": "pm_..."
}
```

**Backend logic:**
1. Validate slug availability
2. Create `Tenant` with `status=pending`, `plan=plan_slug`, `trial_ends_at=NOW()+14d`
3. Create `TenantUser` with `clerk_user_id` from session, `role=owner`
4. Create Stripe `Customer` + attach payment method
5. Create Stripe `Subscription` with trial
6. Store `stripe_customer_id` + `subscription_id` on Tenant
7. Set `status=active`
8. Return tenant + admin redirect URL

---

## 4. Frontend Routes

### Route layout

```
apps/storefront/src/app/(marketing)/             ← group layout (no tenant header)
├── page.tsx                                      ← SaaS landing page (replaces root /)
├── pricing/page.tsx                              ← Pricing matrix (optional standalone page)
├── signup/
│   ├── page.tsx                                  ← Step 1: store info
│   ├── plan/page.tsx                             ← Step 2: plan select + Stripe
│   └── welcome/page.tsx                          ← Step 3: provisioning → admin redirect
```

The `(marketing)` route group uses its own layout with a **marketing header** (brand logo, Pricing, Log In) and **marketing footer** (Terms, Privacy, Contact). No storefront/nav header.

### A. Marketing Landing Page — `/(marketing)/page.tsx`

Server component. Static sections:

1. **Hero** — "The e-commerce platform for independent brands." Subhead about multi-warehouse, subscriptions, global payments. CTA → `/signup`.
2. **Feature Grid** — 6 feature cards with icons: Multi-Warehouse Inventory, Subscriptions Engine, RMA & Returns, Multi-Currency, Analytics & Reports, Team Management.
3. **Showcase Teaser** — Card linking to `/showcase` with a mockup preview.
4. **Pricing Preview** — 3-tier card summary, full table link → `/pricing`.
5. **CTA Section** — Final call-to-action with trial emphasis.

All static content — no API calls. Follows DESIGN.md monochrome editorial aesthetic.

### B. Pricing Matrix — `/(marketing)/pricing/page.tsx`

Client component that fetches `GET /api/v1/public/plans`.

- **Monthly/Annual toggle** — switches displayed prices. Annual shows "20% off" badge + per-month equivalent (£117/mo billed yearly).
- **3 plan cards** — Starter (£49/mo), Pro (£149/mo), Enterprise (£399/mo).
- **Feature lists** — loaded from `SaaSPlan.features` JSON.
- **CTA buttons** — "Start Free Trial" for Starter/Pro, "Contact Sales" for Enterprise.

### C. Onboarding Wizard — `/(marketing)/signup/`

Uses Clerk `<SignUp />` for auth, then collects additional data.

**Step 1 — `/signup`** (combined with Clerk sign-up):
- Store name input
- Subdomain input with `.platform.com` suffix + availability check
- Clerk `<SignUp />` embedded (email + password)
- On submit: creates Clerk user, redirects to `/signup/plan`

**Step 2 — `/signup/plan`**:
- Shows pricing cards from `GET /api/v1/public/plans`
- Stripe Elements `<PaymentElement />` for card collection
- "Start Trial" button → calls `POST /api/v1/public/tenants`
- On success: redirects to `/signup/welcome`

**Step 3 — `/signup/welcome`**:
- "Your store is ready!" with store name + domain
- 5-second animated countdown
- Auto-redirects to `https://admin.platform.com` with session

### D. Proxy (`proxy.ts`) Updates

Add public route passthroughs:

```ts
// Public routes — no tenant param
"/sign-up(.*)",
"/signup(.*)",
"/pricing(.*)",
"/api/v1/public/(.*)",
// Keep existing tenant routes
```

---

## 5. Stripe Integration

### New Stripe products & prices

Create three SaaS products in Stripe (via dashboard or seed script):
- `saas-starter` — monthly £49, yearly £470
- `saas-pro` — monthly £149, yearly £1,430
- `saas-enterprise` — monthly £399, yearly £3,830

Store Stripe price IDs in `SaaSPlan.stripe_price_id_monthly` / `stripe_price_id_yearly`.

### Checkout flow

1. User selects plan + interval on Step 2
2. Frontend calls `POST /api/v1/public/tenants/setup-intent` → creates Stripe `SetupIntent` (collects card without charging, enables trial)
3. Frontend confirms SetupIntent with Stripe Elements
4. Frontend calls `POST /api/v1/public/tenants` with `payment_method_id`
5. Backend attaches payment method to Stripe Customer, creates subscription with `trial_period_days=14`
6. Subscription auto-invoices at trial end

---

## 6. Step-by-Step Execution Plan

1. **Set up Stripe SaaS products** — Create 3 Stripe products/price IDs, add to Doppler
2. **`SaaSPlan` model + migration + seed** — New table, seed 3 plans with prices/features/Stripe IDs
3. **`GET /api/v1/public/plans` endpoint** — Unauthenticated plan listing
4. **`POST /api/v1/public/tenants` endpoint** — Self-serve sign-up with Stripe subscription creation
5. **`POST /api/v1/public/tenants/check-slug` endpoint** — Subdomain availability
6. **Marketing landing page** — Hero, features, showcase link, pricing preview, CTA
7. **Pricing matrix component** — Plan cards with monthly/annual toggle, fetches from API
8. **Onboarding wizard (Step 1)** — Combined Clerk sign-up + store info form
9. **Onboarding wizard (Step 2)** — Plan selection + Stripe payment collection
10. **Onboarding wizard (Step 3)** — Welcome screen + admin redirect
11. **Proxy & routing** — Route group, middleware passthroughs
12. **E2E flow test** — Full sign-up → provisioning → admin redirect

---

## 7. Key Decisions

- **Route group**: `(marketing)` isolates SaaS pages from the storefront layout (no tenant header/nav).
- **Stripe approach**: SetupIntent + trial subscription (no upfront charge). Payment collected at trial end via Stripe.
- **`SaaSPlan` is a new model** — separate from `SubscriptionPlan` (which is for customer-facing product subscriptions).
- **No changes to `Tenant` model** — existing `plan` string and `subscription_id` fields are sufficient.
- **Clerk handles auth** — `SignUp` component for email/password, session passed to backend for `clerk_user_id`.
- **Admin redirect** — After sign-up, user is redirected to `admin.platform.com` where `GET /api/v1/tenants/me` resolves their tenant.
