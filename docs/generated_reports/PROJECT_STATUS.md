# Project Status Report

**Generated:** 2025-06-27  
**Project:** Multi-Tenant Shopify Admin Platform  
**Stack:** Next.js 16 + Clerk + FastAPI + Supabase + Redis + Celery

---

## Architecture

- **Monorepo** (pnpm workspaces): Next.js 16 admin + storefront, FastAPI backend, 5 shared packages
- **Auth:** Clerk v7 (Next.js middleware)
- **DB:** Supabase/PostgreSQL with Row-Level Security via `@repo/tenant-orm`
- **Backend:** FastAPI + SQLModel + Redis + Celery
- **Frontend:** Next.js 16 + TanStack Query + Base UI (shadcn style)

---

## Implemented & Working

| Area | Status |
|------|--------|
| **Tenant ORM** | `tenant-resolver.ts` extracts tenant from request headers, `client.ts` wraps Supabase with tenant scoping |
| **Backend API** | FastAPI app with CORS, lifespan, router registration (`/api/`, `/api/webhooks/`) |
| **API Client** | `@repo/api-client` — typed fetch wrapper with auth header injection |
| **RBAC types** | `rbac.ts` — role/permission definitions |
| **Product table** | `product-table.tsx` — data table with pagination, toolbar, delete dialog |
| **Product CRUD UI** | `products-service.ts` — API hooks for list/delete |
| **Auth page** | `sign-in/page.tsx` — Clerk sign-in form (migrated to v7 API) |
| **Shared UI** | `@repo/ui` — Base UI re-exports, shadcn-style components, styles |
| **Storefront** | Basic Next.js 16 app with Supabase client setup |
| **Webhook router** | Svix endpoint + Shopify webhook handler skeleton |

---

## Partially Implemented

| Area | Gap |
|------|-----|
| **Clerk auth** | `setActive` import fails (not exported from `@clerk/nextjs` in this version), `signIn.create()` return type mismatch — form won't submit |
| **Shopify webhook verification** | HMAC signature check is `TODO` at `webhooks.py:72` — accepts any request |
| **Svix signature verification** | `TODO` at `webhooks.py:29` — no signature validation |
| **Admin role enforcement** | `dependencies.py:128` — `get_admin_user` doesn't verify admin role in tenant |
| **Order sync tasks** | `order_tasks.py:45` — async task queue stub, no actual Celery workers |
| **Tenant context** | `tenant-context.tsx` — fetch logic is commented out, tenant resolution not wired to UI |
| **Product drawer** | `product-drawer.tsx` — references `Drawer` component that doesn't exist in Base UI mapping |
| **Sidebar** | `sidebar copy.tsx` — stale file with syntax errors (double semicolon, missing type imports) |

---

## TODO / Not Built

- **Product create/edit form** — drawer exists but is broken
- **Order management** — webhook handler parses payload but no CRUD UI
- **Tenant management UI** — no admin screens for tenant ops
- **Settings/Profile pages** — no routes beyond sign-in
- **Tests** — zero test files exist anywhere in the monorepo
- **CI/CD** — no GitHub Actions or pipeline config
- **Docker** — no docker-compose or containerization

---

## Failing TypeScript Errors (19 total)

### `apps/admin` (15 errors)

| File | Line | Error |
|------|------|-------|
| `sign-in/page.tsx` | 4 | `setActive` not exported from `@clerk/nextjs` |
| `sign-in/page.tsx` | 37-38 | `status`/`createdSessionId` not on signIn result type |
| `sign-in/page.tsx` | 58 | `authenticateWithRedirect` not on `SignInFutureResource` |
| `sign-in/page.tsx` | 85, 99 | `variant` prop not on Base UI `Button` |
| `table-toolbar.tsx` | 34 | `input.value` — missing DOM lib |
| `data-table.tsx` | 48 | `event.target.value` — missing DOM lib |
| `drawer copy.tsx` | multiple | `document`/`KeyboardEvent.key` — missing DOM lib (10 errors) |

### `packages/tenant-orm` (5 errors)

| File | Line | Error |
|------|------|-------|
| `client.ts` | 31 | `customFetch` not in Supabase client options type |
| `client.ts` | 31 | `fetch` not found |
| `tenant-resolver.ts` | 1 | `Headers` not found |
| `tenant-resolver.ts` | 20 | `Buffer` not found |
| `tenant-resolver.ts` | 28 | `Request` not found |

**Root cause:** All errors are missing lib/types config — admin tsconfig missing `"lib": ["es2023", "dom"]`, tenant-orm tsconfig missing `"types": ["node"]` and `@types/node`.

---

## High-Risk / Messy Areas

| Area | Issue | Risk Level |
|------|-------|------------|
| **`sign-in/page.tsx`** | Clerk v7 API mismatch — `signIn.create()` return type doesn't match what the code expects. Will crash at login attempt. | High |
| **`webhooks.py:29,72`** | **Security risk** — webhook endpoints accept unsigned requests. Shopify/Svix signatures not verified. | Critical |
| **`dependencies.py:128`** | **Security risk** — admin endpoint guard is a no-op comment. Any authenticated user can access admin routes. | Critical |
| **`drawer copy.tsx`** | Stale file with syntax errors sitting in `components/ui/`. Should be deleted. | Low |
| **`sidebar copy.tsx`** | Stale file with syntax errors. Should be deleted. | Low |
| **`tenant-context.tsx`** | Tenant fetch `useEffect` is commented out — UI has no tenant context at runtime. | Medium |
| **No tests** | Zero test coverage across the entire monorepo. No Jest/Vitest/pytest config. | Medium |
| **`packages/tenant-orm/tsconfig.json`** | Missing `@types/node` — can't run TS checks on shared package without Node globals. | Low |

---

## Recommended Priority

1. **Delete stale files** — `drawer copy.tsx`, `sidebar copy.tsx` ✅
2. **Fix tsconfig libs** — add DOM lib to admin, Node types to tenant-orm (clears 20 errors)
3. **Fix Clerk v7 auth** — correct `signIn.create()` return type handling, remove `variant` from Button
4. **Implement webhook signature verification** — security-critical
5. **Implement admin role check** — security-critical
6. **Wire up tenant context** — uncomment fetch logic
7. **Fix product drawer** — add missing Drawer component or use Base UI equivalent
