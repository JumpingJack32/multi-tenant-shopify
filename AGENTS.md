# Session Context — Saved 2026-07-08

## CI Fixes Summary (resolved 2026-07-09)

If CI lint/typecheck/test failures reappear, here's what was fixed:

### 1. `next-env.d.ts` lint errors (`import/no-unresolved`)

- **Root cause**: Next.js generates `next-env.d.ts` with `import "./.next/dev/types/routes.d.ts"` — only exists after build. CI runs lint first.
- **Fix**: Added `{ ignores: ["**/next-env.d.ts"] }` + fallback config turning `import/no-unresolved` off for that file in both `apps/storefront/eslint.config.js` and `apps/admin/eslint.config.js`.

### 2. Import ordering errors

- **Root cause**: `import/order` rule with groups `[builtin, external, internal, parent, sibling, index]`, `newlines-between: always`, `alphabetize: asc`. VSCode auto-format sometimes disagrees.
- **Fix**: Run `pnpm lint --filter @repo/storefront -- --fix` (or the offending app).

### 3. `@repo/codegen#typecheck` — `TS18003: No inputs were found`

- **Root cause**: `src/` had no tracked `.ts` files. `src/generated/` is gitignored. `tsc --noEmit` finds nothing.
- **Fix**:
  - Added `src/index.ts` (`export {};`) as tracked TypeScript placeholder
  - Changed `"hey-api openapi-ts"` → `"openapi-ts"` (correct binary name from `@hey-api/openapi-ts`)
  - Removed `"codegen"` from typecheck's `dependsOn` in `turbo.json` (`openapi.yaml` doesn't exist in repo)

### 4. Unhandled rejection in admin tests

- **Root cause**: `tenant-context.tsx` `catch` block called `setTenantList([])` after component unmount/test teardown → `window is not defined`.
- **Fix**: Added `if (isMounted)` guard around `setTenantList([])` in catch block.

### 5. CI workflow sequence

- Changed to: `lint + typecheck` → `build` → `test` (so `.next/` exists before lint isn't needed, but build runs after lint).

---

## Lint/CI Failures (not yet resolved)

3 failures in CI lint run after pushing `feat/sidebar-restructure`:

1. `@repo/codegen:typecheck` — `error TS18003: No inputs were found in config file .../packages/codegen/tsconfig.json`. Pre-existing; `src/` dir missing or empty. Not caused by our work.
2. `@repo/admin:lint` — `next-env.d.ts` line 3: `import "./.next/dev/types/routes.d.ts"` — `import/no-unresolved`. **Fix we applied**: added `"**/next-env.d.ts"` to eslint ignore patterns in `packages/eslint-config/index.js:8`. Also fixed import ordering in storefront collection pages.
3. `@repo/storefront:lint` — same `next-env.d.ts` issue + 2 import ordering errors in collection pages. **Fix we applied**: same eslint-config ignore + reordered imports.

All 3 fixes committed in `4d1c47b` and pushed. Need to verify CI passes — if `codegen:typecheck` still fails, it's pre-existing and unrelated. If lint still fails for admin/storefront, check that `eslint.config.js` in each app is pulling from `@repo/eslint-config` correctly (the ignore pattern is in the shared config, which both apps extend).

---

# Session Context — Saved 2026-07-09

## Current State

- **Branch:** `round-2-dashboard-customers-collections` on `main`
- **Seed DB**: 3 tenants, 12 products+variants+images, 25 customers+addresses, ~56 orders+items — verified working via curl
- **Dashboard API**: returns real backend data (KPI, fulfillment, low stock, recent orders) — verified working via curl with `X-Tenant-ID` header
- **Frontend**: dashboard was showing "Failed to load dashboard" error banner on first load
- **Root cause fixed**: race condition between `TenantProvider` async fetch and `useDashboard()` reading from `sessionStorage` before tenant was populated
- **Dev servers**: storefront on :3000, admin on :3001, backend on :8000

## Completed This Session (2026-07-09)

### Seed Database

- **`services/backend-api/seed_database.py`**: complete rewrite using SQLModel AsyncSession matching ORM model columns
- Idempotent: `DELETE` existing data → inserts in single transaction, can re-run safely
- 3 tenants (Acme Corp, Globex Inc, Initech), 12 products+variants+images, 25 customers+addresses, ~56 orders+items, inventory per variant×location
- Uses UPPERCASE PG enum values (`'ACTIVE'`, `'PUBLISHED'`, `'PAID'`)
- Does NOT call `trg_sync_customer_agg` trigger (doesn't exist in DB — syncs customer aggregates manually via direct UPDATE)
- Verified 3x against local Supabase (port 54322)

### Dashboard Race Condition Fix

- **`use-dashboard.ts`**: accepts optional `tenantId` parameter; includes it in `queryKey` (`["dashboard", "summary", tid]`); sets `enabled: !!tid` so query doesn't run until tenant is available (falls back to `sessionStorage` if no param)
- **`page.tsx`**: reads `currentTenantId` from `useTenantContext()` instead of `sessionStorage`; shows skeleton while `tenantLoading` or `isPending`; error banner with retry; data display
- Typecheck clean, lint clean, all 20 admin tests pass

### Schema Drift Documented

- ORM models have extra columns not created by Alembic migrations: `tenants.plan`, `tenants.settings`, `tenants.options`, `orders.total` as `Float` vs `INTEGER`

## Completed This Session (2026-07-09) — Race Condition Fix (Round 2)

### Products, Customers, Collections race condition fix

- **Pattern**: All 3 services (`products-service.ts`, `customers-service.ts`, `collections-service.ts`) now accept optional `tenantId` parameter, falling back to `sessionStorage` via `getStorageTenantId()`
- **Hooks**: `useProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useCustomers`, `useCustomer`, `useCollections`, `useCreateCollection`, `useUpdateCollection`, `useDeleteCollection` all accept optional `tenantId` parameter, include it in `queryKey`, set `enabled: !!tid`
- **Pages**: Products page (`products/page.tsx`), Customers page (`customers/page.tsx`), Collections page (`collections/page.tsx`) converted to `"use client"` where needed, read `currentTenantId` from `useTenantContext()`, pass to hooks
- **Detail page**: `customers/[id]/page.tsx` converted to `"use client"` with `use(params)`, passes `tenantId` to `CustomerProfile`
- **Components**: `CustomersTable`, `CollectionsTable`, `CustomerProfile` accept `tenantId` prop; `CollectionModal` includes `X-Tenant-ID` header in fetch calls
- **Loading states**: All pages/components show skeleton/spinner while `tenantLoading` is true (not just query `isPending`)
- **Lint**: clean (`pnpm lint --filter @repo/admin -- --fix` resolved 3 import ordering errors)
- **Typecheck**: clean
- **Tests**: all 20 admin tests pass

## Still To Do

### Medium Priority

- Fix `@repo/tenant-orm` `DashboardSummary` types to match backend response shape (e.g., `low_stock.name` → `product_name`, missing `sku`/`threshold`)
- Remove `: any` casts in dashboard `page.tsx` (low_stock items, recent orders)
- Add dashboard backend tests

### Low Priority

- Replace dashboard page skeleton with shadcn `dashboard-01` SectionCards pattern
- Schema alignment: reconcile ORM model columns with Alembic migrations

## Key Decisions (All)

- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas
- Coverage: v8 provider (root vitest.config.ts with workspace projects), 30% threshold
- Secrets via Doppler only (never .env directly)
- Root `package.json` `"dev"` uses `doppler run -- pnpm turbo run dev`
- Price in cents, display as `£{(n / 100).toFixed(2)}`
- Server components for data fetching; client components for interactivity
- `@repo/ui/components/motion` re-exports `motion` + `AnimatePresence` from `motion/react`
- `@/` import alias works for vitest tests (configured in storefront's vitest.config.ts project)
- ProductCard uses ghost card aesthetic (no border/shadow/background) with `bg-black`
- `proxy.ts` (not `middleware.ts`) is the correct middleware filename for Next.js 16.2.9
- `e.stopPropagation()` required in toggle click handler when placed inside Base UI/Radix menu popovers
- `MobileStickyCta` uses `document.getElementById` (not ref forwarding)
- Safe area padding: `pb-[env(safe-area-inset-bottom)]` via Tailwind v4 arbitrary value
- Atomic UI components live in `packages/ui/src/components/ui/`
- Hook files use `.ts` extension (not `.tsx`) unless they contain JSX

## UI Design

- Always follow the UI design system when creating or reviewing components or pages
- Design system: @DESIGN.md

## Context

- Always follow the project context system when reviewing conflicting versions
- Context system: @PROJECT_CONTEXT.md
