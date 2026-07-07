# Turborepo Multi-Tenant — Priority-Based Phased Plan

> **Date:** 2026-06-26
> **Approach:** A — Priority-Based Phases (aligned with Turborepo dependency graph)
> **Total Effort:** ~76 hours
> **Goal:** Production readiness with clean git history, cached builds, and app-isolated sprints

---

## Phase 0: Foundation — TS Config Fixes (~2h)

**Scope:** Monorepo root + all `tsconfig.json` files
**Turborepo Impact:** Unblocks all type checking; cached once, never rebuilt for frontend changes

### Tasks

| # | Task | Files | Effort |
|---|------|-------|--------|
| 0.1 | Fix `ignoreDeprecations` syntax — change `"ignoreDeprecations": "6.0"` to `"ignoreDeprecations": ["6.0"]` | `tsconfig.json` (root), `apps/admin/tsconfig.json`, `apps/storefront/tsconfig.json`, all `packages/*/tsconfig.json` | 30m |
| 0.2 | Verify `turbo.json` pipeline includes `typecheck` and `build` with proper `dependsOn` | `turbo.json` | 30m |
| 0.3 | Add root-level `turbo run typecheck` script to `package.json` | `package.json` (root) | 15m |
| 0.4 | Run `turbo run typecheck` to confirm zero errors across monorepo | Terminal | 15m |

**Deliverable:** Monorepo type-checks clean. `turbo run typecheck` passes.

---

## Phase 1: Shared Core — Auth & Middleware Packages (~8h)

**Scope:** `packages/` — create `@repo/auth` and `@repo/middleware`
**Turborepo Impact:** Once cached, all frontend builds skip rebuilding these packages entirely

### 1.1 Create `@repo/auth` Package (~4h)

| # | Task | Details |
|---|------|---------|
| 1.1.1 | Create `packages/auth/` with `package.json`, `tsconfig.json`, `src/index.ts` | Export shared auth types, token helpers, Clerk middleware utilities |
| 1.1.2 | Extract JWT create/decode/verify logic | Pull from `services/backend-api/src/core/security.py` → TypeScript equivalents for frontend middleware |
| 1.1.3 | Implement Clerk token verification utilities | Audience/issuer validation, JWKS cache with TTL (fixes Backend issue #2, #5) |
| 1.1.4 | Export `createClerkMiddleware()` function | Returns Next.js middleware factory that verifies Clerk JWTs and attaches user context |

### 1.2 Create `@repo/middleware` Package (~4h)

| # | Task | Details |
|---|------|---------|
| 1.2.1 | Create `packages/middleware/` with `package.json`, `tsconfig.json`, `src/index.ts` | Export shared middleware utilities |
| 1.2.2 | Implement webhook signature verification | Svix HMAC verification for backend (fixes Backend issue #1 — `routes/webhooks.py:29`), Shopify HMAC for storefront |
| 1.2.3 | Implement rate limiting utilities | Token bucket or sliding window middleware for FastAPI and Next.js API routes |
| 1.2.4 | Implement CORS configuration helper | Fixes Backend issue #4 — generates valid CORS config from `settings.allowed_origins` |

### Deliverables

- `packages/auth/` — Clerk token verification, JWT helpers, middleware factory
- `packages/middleware/` — Webhook signature verification, rate limiting, CORS config
- Both packages build cleanly: `turbo run build --filter=@repo/auth` and `@repo/middleware`

---

## Phase 2: Tenant Isolation & Data Layer (~15h)

**Scope:** `services/backend-api/src/` — fix tenant isolation, security, and data models
**Turborepo Impact:** Backend is the data source; once this layer is solid, frontend apps can build with confidence

### 2.1 Security Hardening (~6h)

| # | Task | File | Severity |
|---|------|------|----------|
| 2.1.1 | Implement Svix signature verification | `routes/webhooks.py:29` | 🔴 Critical |
| 2.1.2 | Add Clerk JWT audience/issuer validation | `core/clerk_jwks.py` | 🟡 High |
| 2.1.3 | Fix CORS wildcard + credentials conflict | `main.py:49-50` | 🟡 High |
| 2.1.4 | Add JWKS cache TTL expiry | `core/clerk_jwks.py` | 🟢 Medium |
| 2.1.5 | Implement admin bypass audit logging | `core/tenant_isolation.py` | 🟡 High |
| 2.1.6 | Replace hardcoded default tenant UUID with `None` + explicit raise | `dependencies.py:13` | 🟢 Medium |

### 2.2 Tenant Isolation Fixes (~4h)

| # | Task | Details |
|---|------|---------|
| 2.2.1 | Mount `TenantMiddleware` from `middleware/tenant_middleware.py` | Replace the stub middleware at `main.py:75-78` with the robust implementation. |
| 2.2.2 | Fix event listener gaps in `append_select_where_clause` | Handle subqueries with joins, raw SQL, and `INSERT ... SELECT` patterns |
| 2.2.3 | Add background task tenant isolation mechanism | Prevent stale context in async tasks via `ContextVar` propagation |
| 2.2.4 | Document raw SQL scoping requirements | Add inline comments and developer guidelines |

### 2.3 StoreUserLink Junction Table (~5h)

| # | Task | Details |
|---|------|---------|
| 2.3.1 | Create `StoreUserLink` model | Define M:N relationship between `TenantUser` and stores with roles |
| 2.3.2 | Create `StoreRole` enum | `OWNER`, `ADMIN`, `STAFF` — separate from `UserRole` for contextual permissions |
| 2.3.3 | Create Pydantic schemas | `StoreUserLinkCreate`, `StoreUserLinkPublic`, `StoreUserLinkUpdate` |
| 2.3.4 | Create API routes | `routes/stores.py` — CRUD + link/unlink operations |
| 2.3.5 | Add database migration | Generate migration for `store_user_links` table with unique constraint |

### Deliverables

- Backend security hardened: webhook signatures verified, JWT claims validated, CORS fixed
- Tenant isolation robust: middleware mounted, event listeners fixed, background task isolation
- `StoreUserLink` table and API routes implemented
- Database migration ready

---

## Phase 3: Admin App Sprint (~18h)

**Scope:** `apps/admin/` — lock in, wire up routes, fix architecture
**Turborepo Impact:** Changes only affect `apps/admin`; backend and storefront remain cached

### 3.1 Security & Middleware (~4h)

| # | Task | Details |
|---|------|---------|
| 3.1.1 | Create `middleware.ts` | Server-side route protection using `@repo/auth` Clerk middleware |
| 3.1.2 | Implement server-side auth verification | RBAC checks on protected routes, not just client-side |
| 3.1.3 | Fix API client token handling | Throw error instead of returning `null` when Clerk session missing |
| 3.1.4 | Validate Supabase credentials | Remove `!` assertions, add proper env var validation |

### 3.2 Architecture Fixes (~4h)

| # | Task | Details |
|---|------|---------|
| 3.2.1 | Fix singleton `QueryClient` anti-pattern | Create inside component or memoize with `useMemo` in `app-shell.tsx` |
| 3.2.2 | Remove duplicate data fetching layer | Consolidate `api/client.ts` and `products-service.ts` — remove redundant `getTenantId()` calls and unsafe casts |
| 3.2.3 | Fix product form typing | Replace `any` with proper `ProductFormData` interface |
| 3.2.4 | Delete stale "copy" files | Remove `drawer copy.tsx` and `sidebar copy.tsx` |

### 3.3 Missing Pages & Features (~6h)

| # | Task | Details |
|---|------|---------|
| 3.3.1 | Create Dashboard page | `app/(app)/dashboard/page.tsx` — analytics overview, recent orders, product stats |
| 3.3.2 | Create Orders page | `app/(app)/orders/page.tsx` — order listing with status filters |
| 3.3.3 | Create Settings page | `app/(app)/settings/page.tsx` — tenant settings, user management |
| 3.3.4 | Fix tenant context fetch logic | Uncomment and fix `tenant-context.tsx:37-78` — enable tenant switching |
| 3.3.5 | URL-synced pagination | Move `page` and `pageSize` to URL query params |

### 3.4 Polish & UX (~4h)

| # | Task | Details |
|---|------|---------|
| 3.4.1 | Add error boundaries | Wrap app shell and route groups with `ErrorBoundary` |
| 3.4.2 | Add loading states | Skeleton loaders for product table, dashboard, orders |
| 3.4.3 | Add toast/notification system | Success/error feedback on CRUD operations |
| 3.4.4 | Fix pagination state | Make `pageSize` mutable, wire up `onPageSizeChange` |

### Deliverables

- Admin app fully protected with server-side middleware
- Architecture cleaned: no singleton anti-patterns, no duplicate fetching
- All sidebar navigation links functional (Dashboard, Orders, Settings)
- Tenant context working, pagination URL-synced
- Error boundaries, loading states, toast notifications implemented

---

## Phase 4: Storefront App Sprint (~18h)

**Scope:** `apps/storefront/` — wire up tenant client, cart, checkout
**Turborepo Impact:** Changes only affect `apps/storefront`; admin and backend remain cached

### 4.1 Security & Middleware (~3h)

| # | Task | Details |
|---|------|---------|
| 4.1.1 | Create `middleware.ts` | Wire up Clerk auth middleware from `proxy.ts` — enable tenant-aware auth |
| 4.1.2 | Validate tenant slug on entry | Add DB validation for `[tenant]` route parameter |
| 4.1.3 | Remove hardcoded Supabase anon key | Move to env var, add validation |

### 4.2 Tenant Client & Data Layer (~5h)

| # | Task | Details |
|---|------|---------|
| 4.2.1 | Functionalize `createTenantClient` | Set proper `tenantId`, call `withTenantScope()` to enforce RLS |
| 4.2.2 | Enable `QueryClientProvider` | Uncomment in `layout.tsx:25-27` |
| 4.2.3 | Create `StoreContext` | Store name, logo, theme, currency configuration |
| 4.2.4 | Fix product status type mismatch | Align TS types with DB schema: `'active'` instead of `'published'` |

### 4.3 Cart & Checkout (~5h)

| # | Task | Details |
|---|------|---------|
| 4.3.1 | Persist cart to localStorage | Replace ephemeral Zustand store with `persist` middleware |
| 4.3.2 | Create checkout flow | Connect cart to Shopify Checkout API or backend checkout route |
| 4.3.3 | Add cart persistence across sessions | Sync Zustand store with user account on login |

### 4.4 UI & Pages (~5h)

| # | Task | Details |
|---|------|---------|
| 4.4.1 | Create `(store)` route group | Organize storefront pages: products, product detail, cart, checkout |
| 4.4.2 | Create product detail page | `/[tenant]/[product]` route with full product info |
| 4.4.3 | Add header/footer/navigation | Layout components with cart icon, tenant branding |
| 4.4.4 | Add search/filter/sort | Product discovery features on product listing |
| 4.4.5 | Add loading/skeleton states | Loading UI for products, cart, checkout |

### Deliverables

- Storefront auth wired up with middleware
- Tenant client functional, RLS enforced
- Cart persisted, checkout flow connected
- Product detail page, header/footer, search/filter implemented

---

## Phase 5: Global Polish (~13h)

**Scope:** Monorepo-wide — E2E testing, rate limiting, error handling
**Turborepo Impact:** Final validation across all apps and packages

### 5.1 Rate Limiting & API Hardening (~4h)

| # | Task | Details |
|---|------|---------|
| 5.1.1 | Apply rate limiting to all public endpoints | Use `@repo/middleware` rate limiter on FastAPI routes |
| 5.1.2 | Add rate limiting to Next.js API routes | Server-side rate limiting for storefront and admin API calls |
| 5.1.3 | Clean up unused dependencies | Remove `@repo/codegen`, `@hookform/resolvers`, `react-hook-form`, `zod` from storefront if unused |

### 5.2 E2E Testing Setup (~5h)

| # | Task | Details |
|---|------|---------|
| 5.2.1 | Install and configure Playwright | Root-level E2E test setup for both admin and storefront |
| 5.2.2 | Create admin E2E tests | Sign-in, product CRUD, tenant switching |
| 5.2.3 | Create storefront E2E tests | Tenant resolution, product browsing, cart flow |
| 5.2.4 | Add CI pipeline for E2E tests | GitHub Actions or Turborepo pipeline integration |

### 5.3 Error Handling & Polish (~4h)

| # | Task | Details |
|---|------|---------|
| 5.3.1 | Add multi-tenant error boundaries | Graceful failure UI when tenant data is unavailable |
| 5.3.2 | Add global error handling middleware | Centralized error logging and user-friendly messages |
| 5.3.3 | Add API documentation | Swagger/OpenAPI customization for FastAPI backend |
| 5.3.4 | Final cleanup | Remove dead code, unused imports, console logs |

### Deliverables

- Rate limiting active on all public endpoints
- E2E test suite covering critical user flows
- Error boundaries and global error handling in place
- API documentation available

---

## Phase Execution Summary

| Phase | Scope | Hours | Key Deliverable |
|-------|-------|-------|-----------------|
| **0** | TS Configs | ~2h | Monorepo type-checks clean |
| **1** | Shared Core Packages | ~8h | `@repo/auth`, `@repo/middleware` built and cached |
| **2** | Backend Security & Data | ~15h | Webhook signatures, tenant isolation, StoreUserLink |
| **3** | Admin App Sprint | ~18h | Protected routes, fixed architecture, all pages functional |
| **4** | Storefront App Sprint | ~18h | Auth wired, tenant client functional, cart/checkout |
| **5** | Global Polish | ~13h | Rate limiting, E2E tests, error handling |
| **Total** | | **~76h** | Production-ready multi-tenant platform |

---

## Turborepo Cache Strategy

```
Phase 0 (TS Configs)
  └─ turbo run typecheck → caches all packages/apps
Phase 1 (Shared Core)
  ├─ turbo run build --filter=@repo/auth → caches auth package
  └─ turbo run build --filter=@repo/middleware → caches middleware package
Phase 2 (Backend)
  └─ turbo run build --filter=backend-api → caches backend (depends on Phase 1)
Phase 3 (Admin)
  └─ turbo run build --filter=admin → caches admin (depends on Phase 1, 2)
Phase 4 (Storefront)
  └─ turbo run build --filter=storefront → caches storefront (depends on Phase 1, 2)
Phase 5 (Global)
  └─ turbo run e2e → validates all cached builds
```

**Key Principle:** Once a phase completes and builds, subsequent phases that don't touch those files will skip rebuilding, leveraging Turborepo's remote or local cache.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Shared packages break frontend imports | Test with `turbo run build --filter=admin --filter=storefront` after Phase 1 |
| Backend schema changes break frontend types | Generate TypeScript types from SQLModel schemas after Phase 2 |
| Admin and Storefront conflicts | Strict phase isolation — no cross-app changes during Phases 3-4 |
| E2E tests flaky | Use Playwright's auto-waiting, fix flaky tests before Phase 5 sign-off |

---

## Success Criteria

1. ✅ `turbo run typecheck` passes with zero errors
2. ✅ `turbo run build` succeeds for all apps and packages
3. ✅ All webhook endpoints verify signatures
4. ✅ Admin routes protected server-side
5. ✅ Storefront tenant client enforces RLS
6. ✅ StoreUserLink junction table implemented and tested
7. ✅ Cart persists across sessions
8. ✅ E2E tests cover sign-in, product CRUD, cart flow
9. ✅ Rate limiting active on public endpoints
10. ✅ Error boundaries handle multi-tenant failures gracefully
