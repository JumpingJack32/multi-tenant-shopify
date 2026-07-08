# Session Context — Saved 2026-07-08

## Current State

- **Branch:** `round-2-dashboard-customers-collections` on `main` — 20 commits ahead
- **All sidebar work complete.** 139 tests pass (38 files).
- **Dev servers**: storefront on :3000, admin on :3001

## Completed — Sidebar restructure

- **Rebuilt sidebar** from 9 flat links to 11-item Shopify-style hierarchy with 8 hover-dropdown sub-menus
- **Products** dropdown: Collections, Inventory, Purchase Orders, Transfers, Gift Cards
- **Content** dropdown: Pages, Blog Posts, Files & Media Library, Metafields
- **Finances** dropdown: Financial Overview, Payouts, Capital, Tax Liabilities
- **Analytics** dropdown: Dashboards, Reports, Live View, Custom Reports
- **Marketing** dropdown: Campaigns, Automation
- **Discounts** dropdown: Discount Codes, Automatic Discounts, Gift Cards / Store Credit, Campaign Scheduler
- **Sales Channel** dropdown: Online Store, Point of Sale, Shop
- **Settings** dropdown: Users & Permissions, Store Details, Payments, Checkout, Shipping & Delivery, Taxes & Duties, Notifications
- **Pure CSS hover** using `grid-rows-[0fr]→[1fr]` + `opacity` + `visibility` — no JS state, no React context
- **Typecheck**: clean for both `@repo/ui` and `admin`
- **Tests**: 139/139 pass (38 files)

## Completed Commits (previous sessions)

```
8854385 feat(admin): add Customers link to sidebar navigation
cdcd8f4 feat(admin): add customer detail page with profile card and order ledger
e05a0cd feat(admin): add collections management page with CRUD table and modal
d9dd605 feat(admin): add collection multi-select to product form
5f8df81 feat(storefront): add collection browsing routes and hero cards
c23547c feat(ui): add hover-dropdown sub-menus to NavMain
d423664 feat(ui): add hover-dropdown sub-menus to NavSecondary
9643b9e feat(admin): populate sidebar with Shopify-style navigation hierarchy
```

## Completed Work (Previous Sessions)

### DB Migrations

- **0005** — `customers` + `customer_addresses` tables, RLS, sync trigger on `orders`
- **0006** — `collections` + `product_collections` tables, RLS, indexes

### Backend API

- **Customer routes**: `GET /customers/` (paginated, search), `GET /customers/{id}` (detail with addresses/orders, AOV)
- **Collection routes**: CRUD + soft delete + product assignment (7 endpoints, 13 tests)
- **Dashboard endpoint**: `GET /admin/dashboard/summary` (KPI, fulfillment, low stock, recent orders)
- **Public collections**: `GET /collections/{tenant_slug}` (storefront-facing)
- **Public products/categories endpoints** (pre-existing, not modified)

### Shared (tenant-orm)

- **Types**: `Collection`, `Customer`, `CustomerDetail`, `DashboardSummary` + nested types
- **Zod schemas**: `CollectionSchema`, `CustomerSchema`, `DashboardSummarySchema` + create/update variants

### Admin App (frontend infra)

- **API client**: `api.customers`, `api.collections`, `api.dashboard` added to existing client
- **Services**: `customers-service.ts`, `collections-service.ts`
- **Hooks**: `useCustomers`, `useCustomer`, `useDashboard`, `useCollections`, `useCreateCollection`, `useUpdateCollection`, `useDeleteCollection`

### Key Decisions Made Today

- `orders.total` is `INTEGER` cents (per migration 0001). All `* 100` multiplications in queries are bugs — use raw `total`.
- `orders.status` column can be TEXT (migrations) or SAEnum-based PG enum (test `create_all`). Use `LOWER(status::text)` for case-insensitive comparisons in raw SQL queries.
- AOV guard always: `revenue // orders if orders > 0 else 0` (not orders // revenue).
- Dashboard queries run **sequentially** on a single `AsyncSession` (can't parallelize on same connection).
- Test cleanup for async tests uses `delete` on specific tables (not `drop_all` — avoids destroying tables other tests depend on).
- Address defaults `average_order_value: int = 0` in Pydantic schema for zero-division guard.
- Customer schema refactored: `CustomerCreate/Update/Response` moved from `product.py` to `customer.py`; `total_spent` changed to `int`.
- `status` import from `fastapi` already available in `public.py`.

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
