# Project Status Report — 2026-07-01

## What's Implemented & Working

### Monorepo Foundation
- Turborepo v2 with pnpm workspaces — `dev`, `build`, `lint`, `typecheck` pipelines
- Shared TS configs (base, nextjs, react-library), shared ESLint config
- All 6 workspace packages build successfully

### Shared Packages
- **`@repo/auth`** — Clerk auth hooks, API client with token injection, middleware factory, tenant context provider
- **`@repo/middleware`** — Webhook signature verification (Svix), rate limiter, CORS config
- **`@repo/tenant-orm`** — Supabase client factory, Zod schemas for Tenant/Product/Order, tenant resolver
- **`@repo/shared-utils`** — `cn()`, `formatCurrency`, `formatDate`, `formatRelativeTime`, env validation
- **`@repo/ui`** — Tailwind 4 + Base UI 1.x + shadcn/ui; exports `button`, `card`, `data-table`, `table`, `motion`; light/dark mode via `next-themes`

### Backend API (`services/backend-api/`)
- FastAPI app with lifespan, CORS middleware, tenant isolation middleware
- **ORM models** (SQLModel): Tenant, TenantUser, ClerkWebhookEvent, Product, ProductImage, Variant, Inventory, Location, Order, OrderItem, Customer, CustomerAddress, VariantPrice, TaxRate, EntityTranslation
- **Routes**: tenants CRUD, products CRUD, orders CRUD, customer auth (register/login/refresh/logout), admin auth (same + `/me`, `/verify`), webhooks (Svix + Shopify)
- **Auth**: Clerk JWKS verification (Elliptic Curve P-256, TTL cache), custom JWT (python-jose, access + refresh tokens), bcrypt password hashing
- **Tenant Isolation**: SQLAlchemy event listeners auto-inject `tenant_id` via ContextVar
- **Alembic migrations**: initial schema + platform superuser flag
- **Redis**: client singleton, rate limiting, JWT blacklist, cache, distributed locks
- **Seed script**: creates 3 sample tenants with products, customers, and orders

### Admin App (`apps/admin/`)
- Clerk auth (sign-in page, protected routes via proxy.ts)
- **App shell**: `ClerkProvider` → `QueryClientProvider` → `TenantProvider` → `RbacProvider`
- **Sidebar**: tenant switcher popover, collapsible nav sections
- **Header**: user avatar, tenant pill, role badge, sign-out menu
- **Products CRUD** (fully implemented):
  - Data table with pagination, sorting, toolbar
  - Right-side slide-out drawer with form (react-hook-form + Zod)
  - Delete confirmation dialog
  - RBAC-based UI toggles (admin/member/viewer)
  - TanStack Query hooks for all mutations
- **Dashboard**: stat cards (product count, orders placeholder, role), quick links

### Storefront (`apps/storefront/`)
- Clerk auth, `QueryClientProvider`
- Dynamic tenant route `[tenant]/` — server component querying Supabase directly
- Zustand cart store (add, remove, clear)
- ProductCard component

### TypeScript Typecheck
- **All packages pass** — `@repo/shared-utils`, `@repo/middleware`, `@repo/tenant-orm`, `@repo/codegen`, `@repo/auth`, `@repo/ui`, `@repo/admin`, `@repo/storefront`

---

## What's Partially Implemented

| Feature | What's Done | What's Missing |
|---------|-------------|----------------|
| **Admin Dashboard** | Stat cards, role display, quick links | Real metrics (order count, revenue, recent activity), charts, per-tenant date range |
| **Admin Orders** | Placeholder page with title | Table, CRUD, filtering, status management, customer info |
| **Admin Settings** | Placeholder page with title | Actual settings form (store details, payment config, shipping, users) |
| **Storefront** | Tenant route, product listing, cart store | Checkout flow, customer account pages, order history, product detail page, search/filter |
| **Backend Tests** | 4 pytest files exist | Can't run — `ModuleNotFoundError: No module named 'src'` (missing PYTHONPATH or editable install) |
| **Codegen** | hey-api config, generated stubs exist | Empty — no actual generated clients/schemas (requires running backend to get OpenAPI spec) |
| **Image Processing** | `tasks/image_processing.py` stub exists | No implementation |
| **Rate Limiting** | Redis-based rate limiter in `core/cache.py` | Not wired into any route |
| **Webhooks** | Svix + Shopify verification exists | No real webhook handler logic beyond verification, Clerk webhooks endpoint not exposed in router |

---

## What's Still TODO

### Immediate Gaps
- **Lint is broken** — both Next.js apps fail (`ESLint couldn't find config file`); no `eslint.config.*` exists
- **No JS/TS tests** — vitest configured in both apps but zero test files exist anywhere in the JS/TS workspace
- **`turbo.json` has no `test` task** — `npm test` fails with "Could not find task 'test'"
- **Storefront `[tenant]/page.tsx`** references `product.price` — but `price` was removed from the Product Zod schema in `@repo/tenant-orm` (it's now on `Variant`)

### From Active Plans
- Orders CRUD in admin app
- Settings page in admin app
- Storefront checkout flow
- Storefront customer account pages
- Storefront product detail pages
- E2E tests (Playwright)
- Admin Orders API integration in the admin frontend
- Image processing background tasks

### Infrastructure
- Production Supabase project setup and migration
- Doppler secrets for production
- CI/CD pipeline
- Docker Compose or similar for local backend + Redis

---

## Failing Tests & Obvious Errors

### Lint
```
@repo/admin:lint:   ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
@repo/storefront:lint:   ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```
Both Next.js apps have `"lint": "eslint ."` in their `package.json` but no ESLint config file exists anywhere in the monorepo.

### Backend Tests
```
ModuleNotFoundError: No module named 'src'
```
4 pytest files exist but can't run. Fix: add `PYTHONPATH` or use `uv run --with-editable . pytest` or a `conftest.py` that inserts `src` into `sys.path`.

### Storefront Schema Mismatch
`apps/storefront/src/app/[tenant]/page.tsx:27` references `product.price` — but the `Product` schema in `@repo/tenant-orm` no longer has a top-level `price` field (it's on `Variant`). This will be a runtime error if the page renders a product with no `price` property.

---

## High-Risk / Messy Areas

### Security
1. **CORS wildcard default** — `allowed_origins` defaults to `"*"` in `config.py:41`. The CORS middleware correctly sets `allow_credentials=False` when wildcard is present, so it's not a vulnerability right now, but in production specific origins should be enforced.
2. **No server-side auth middleware** — Admin app uses `proxy.ts` (Clerk middleware) and client-side RBAC, but there's no middleware validating that the user actually belongs to the tenant they're accessing on the Next.js server side.
3. **TenantMiddleware in backend** — The `TenantMiddleware` falls back to `claims.get("sub")` as tenant_id if no explicit `tenant_id` claim exists in the Clerk JWT (line 18). This could leak data between tenants if Clerk subjects overlap with tenant IDs in an unexpected way.

### Architecture
4. **Storefront bypasses backend API** — `apps/storefront/src/app/[tenant]/page.tsx` queries Supabase directly with the Supabase anon key, not via the backend API. This means no tenant isolation middleware, no auth checks, and the anon key is client-visible.
5. **Two auth systems** — The backend has both Clerk JWT verification and its own custom JWT (python-jose) for customer/admin auth. There's overlap and potential confusion about which auth mechanism to use when.

### Code Quality
6. **Alembic initial migration** — `0001_initial.py` contains a raw SQL string with inline `current_setting('app.current_tenant_id')` references. If the PostgreSQL `app.current_tenant_id` setting isn't properly configured, RLS will silently return zero rows.
7. **ContextVar tenant isolation** — Relies entirely on `ContextVar` being set per-request. If any async code path doesn't properly propagate the context, tenant data can leak.
8. **Empty `.next/` directories in git** — The `.gitignore` doesn't cover `.next/` properly; build artifacts may be tracked.

### Maintenance
9. **No JS/TS tests anywhere** — Zero unit/integration tests for any shared package, hook, or component. Refactoring is risky.
10. **Backend test suite unusable** — Python tests exist but can't execute, so there's no safety net for backend changes.
11. **5 large plan documents** in `docs/superpowers/plans/` — Some contain speculative or superseded content. Keeping all of them current is overhead.

---

## Overall Health

| Area | Status |
|------|--------|
| TypeScript typecheck | ✅ All green |
| Build | ✅ All packages build |
| Lint | ❌ Broken (no ESLint config) |
| Backend tests | ⚠️ 4 files exist, can't run |
| JS/TS tests | ❌ Zero tests exist |
| E2E tests | ❌ Not started |
| CI/CD | ❌ Not set up |

The project has a solid architectural foundation with good patterns (monorepo, shared packages, tenant isolation, Clerk auth), but has significant gaps in testing, linting, and several unfinished features. The immediate priorities should be fixing the build/lint pipeline, making backend tests runnable, and addressing the storefront Supabase bypass.
