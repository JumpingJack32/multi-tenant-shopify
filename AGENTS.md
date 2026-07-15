# Session Context — Saved 2026-07-12 (Storefront Currency Switcher — Merged)

> [!IMPORTANT]
> After generating or modifying any backend files, you must check the existing database schema. Ensure tables, fields, are populated.

## Storefront Currency Switcher — Merged to main (2026-07-12)

### PR #11 — `feat: storefront currency switcher`

- Backend: PriceConverter, CurrencyAwareRoute (APIRoute), CurrencyExtractorMiddleware
- Frontend: CurrencySwitcher component with 20 currencies, SSR cookie
- 24 backend tests + 154 frontend tests

### PR #12 — `fix: add missing tenant-orm exports and orders service tests`

- Added `./utils` and `./types` exports to `@repo/tenant-orm/package.json`
- Committed orders service tests that were missed in prior session

### 1. Order Status Transition Validation

- `services/backend-api/src/services/order_state_machine.py` — state machine with `VALID_TRANSITIONS` dict and `validate_transition()` function
- Valid transitions: `pending→{confirmed,paid,cancelled}`, `confirmed→{paid,processing,shipped,cancelled}`, `paid→{processing,shipped,cancelled,refunded}`, `processing→{shipped,cancelled}`, `shipped→{delivered,cancelled,refunded}`, `delivered→{refunded}`, `cancelled/refunded` are terminal
- Integrated into `PUT/PATCH /orders/{id}` — returns 422 with state machine error message on invalid transitions
- `OrderStateError` dataclass exception with `current_status`, `target_status`, `message`

### 2. Filtering/Sorting on Orders List

- Added `customer_id` (UUID), `created_after` / `created_before` (ISO 8601), `sort_by` (created_at/order_number/total/status), `sort_order` (asc/desc) query params to `GET /orders/`
- Allowed sort fields validated against a whitelist; invalid falls back to `created_at`

### 3. Backend Tests

- `tests/test_order_state_machine.py` — 25 tests covering valid transitions, invalid transitions, terminal states, unknown status, self-transitions
- `tests/test_orders.py` — 21 API integration tests covering list (empty, filtered, sorted, paginated, tenant isolation), get (found, 404, cross-tenant isolation), create, update (valid transition, invalid transition → 422, cancelled → 422, notes update, PATCH)
- Fixed `tests/conftest.py` — sys.path inserted `../src` instead of `../` (was broken for all tests)

### 4. Frontend Tests

- `apps/admin/src/features/orders/api/__tests__/orders-service.test.ts` — 5 tests for `fetchOrders`, `fetchOrder`, `updateOrderStatus`, `fetchOrderLinkedPOs`, empty tenant fallback
- `apps/admin/src/features/orders/hooks/__tests__/use-orders.test.tsx` — 7 tests for `useOrders`, `useOrder`, `useUpdateOrderStatus`, `useOrderLinkedPOs`, error state, disabled state
- `apps/admin/src/components/orders/__tests__/orders-table.test.tsx` — 5 tests for rendering, empty state, click handler, customer email, currency/date formatting
- Added `./utils` and `./types` exports to `packages/tenant-orm/package.json` for vitest resolution

### Verification

- Backend: 169 collected, 145 passed, 12 pre-existing failures (inventory float→int, tenant middleware, tenants), 12 pre-existing errors (inventory/purchase-orders fixtures)
- Admin frontend: 9 test files, 36 tests, all pass

## Files Changed (Order Management)

| File                                                                  | Change                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `services/backend-api/src/services/order_state_machine.py`            | New: state machine with `VALID_TRANSITIONS` + `validate_transition()` |
| `services/backend-api/src/routes/orders.py`                           | Added state validation, sorting/filtering params                      |
| `services/backend-api/tests/conftest.py`                              | Fixed sys.path (was inserting `src` instead of project root)          |
| `services/backend-api/tests/test_order_state_machine.py`              | New: 25 unit tests for order state machine                            |
| `services/backend-api/tests/test_orders.py`                           | New: 21 API integration tests for orders                              |
| `apps/admin/src/features/orders/api/__tests__/orders-service.test.ts` | New: 5 service tests                                                  |
| `apps/admin/src/features/orders/hooks/__tests__/use-orders.test.tsx`  | New: 7 hook tests                                                     |
| `apps/admin/src/components/orders/__tests__/orders-table.test.tsx`    | New: 5 component tests                                                |
| `packages/tenant-orm/package.json`                                    | Added `./utils` and `./types` exports                                 |

## Files Changed (Storefront Currency Switcher)

| File                                                              | Change                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `services/backend-api/src/orm/schemas/storefront.py`              | Tagged variant/product price fields with `is_price`                                   |
| `services/backend-api/src/orm/schemas/cart.py`                    | Tagged cart price fields with `is_price`                                              |
| `services/backend-api/src/orm/schemas/order.py`                   | Tagged order/order-item price fields with `is_price`                                  |
| `services/backend-api/src/core/pricing/__init__.py`               | New: pricing package marker                                                           |
| `services/backend-api/src/core/pricing/interceptor.py`            | New: `PriceConverter` and `CurrencyAwareRoute`                                        |
| `services/backend-api/src/core/pricing/middleware.py`             | New: `CurrencyExtractorMiddleware`                                                    |
| `services/backend-api/src/routes/storefront.py`                   | Wired `CurrencyAwareRoute`, `request.state.base_currency`, checkout currency override |
| `services/backend-api/src/main.py`                                | Added `CurrencyExtractorMiddleware`                                                   |
| `services/backend-api/tests/test_interceptor.py`                  | New: 24 tests for PriceConverter, CurrencyAwareRoute, \_apply_rate                    |
| `apps/storefront/src/components/storefront/currency-switcher.tsx` | New: CurrencySwitcher dropdown component                                              |
| `apps/storefront/src/app/[tenant]/layout.tsx`                     | Added CurrencySwitcher to header nav, SSR cookie read                                 |

## Completed 2026-07-13 — Abandoned Cart Recovery

**Architecture:**

- Cart model: `CartStatus` enum, `email`, `status`, `last_reminded_at`, `unsubscribed`, `completed_at` fields + migration
- Checkout: accepts `customer_email`, soft-delete (`status=completed`) instead of hard-delete
- EmailService: abstract base + `LogEmailService` mock + `ResendEmailService` (production via httpx)
- Background worker: `asyncio.create_task()` polls every 15min, `SELECT FOR UPDATE SKIP LOCKED`, commit-before-IO
- Unsubscribe: `POST /api/v1/public/carts/unsubscribe/{hmac_token}` — privacy-safe
- Recovery URL: uses `Tenant.domain` when configured, falls back to slug placeholder

**Frontend:**

- Email input in checkout flow
- Cart cookie + localStorage cleared on checkout success
- Stale completed cart detection on hydration

**Email:** Jinja2 templates parameterized with `{{ currency_symbol }}` from `Tenant.settings["currency"]`. ResendEmailService fully implemented — activated when `RESEND_API_KEY` is set in Doppler.

**Defensive error handling:**

- Per-cart `try/except` in payload building loop — a single bad cart doesn't crash the batch
- Per-item `try/except` for `variant.product.name` — deleted variants gracefully become "Product" with price 0
- Per-cart `try/except` in send loop — network or API errors logged, cart retries in 24h
- `selectinload(Cart.items).selectinload(CartItem.variant).selectinload(Variant.product)` — prevents async greenlet lazy-load crashes

**Resend config:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL` set in Doppler (`dev` config). Domain `multiDNS-tenant-shopify.com` added in Resend (Ireland region) — verification (TXT record) pending before emails send.

**Ruff:** 72 auto-fixed + 13 unsafe-fixed. 2 remaining: Alembic star import (`alembic/env.py:16` — intentional) and `CustomerResponse` forward reference (`src/orm/schemas/product.py:154` — pre-existing).

**Tests:** 14 backend tests (model, email service, token utils, service, unsubscribe, recovery URL variants) + 12 admin detail page tests + 48 total admin tests — all passing.

## Key Decisions

- Background worker follows existing `asyncio.create_task()` pattern (no Celery/Redis queue)
- Email: `LogEmailService` for dev, `ResendEmailService` for production (auto-detected from settings.resend_api_key)
- `SELECT FOR UPDATE SKIP LOCKED` + commit-before-IO prevents double-email
- `Cart.tenant_id` matches `Tenant.tenant_id` (business identifier), not `Tenant.id` (PK)
- `use(Promise)` pattern in page params requires extracting content into separate component for testability
- `Cart.unsubscribed == False` with `# noqa: E712` — correct SQLAlchemy column expression despite ruff rule
- Currency symbol in email templates resolved from `Tenant.settings["currency"]` via 20-entry `CURRENCY_SYMBOLS` map
- Recovery URL uses `Tenant.domain` when set, otherwise falls back to `https://{slug}/cart?recover={id}`
- Defensive per-cart/per-item try/except in abandoned cart worker prevents single bad payload from crashing 15-min cycle
- Resend API calls use `httpx.AsyncClient` with 30s timeout; non-2xx responses return False (no exception thrown)
- `selectinload` chaining required for async CartItem.variant.Variant.product access (greenlet error otherwise)

## Completed 2026-07-14 — Real Email Delivery via notify.amoagou.com

- **Domain verified:** `notify.amoagou.com` added and verified in Resend (eu-west-1).
- **Doppler:** `RESEND_FROM_EMAIL` updated to `noreply@notify.amoagou.com`.
- **Real delivery test:** HTTP 200 from `POST https://api.resend.com/emails` → email sent from `noreply@notify.amoagou.com` to `giogunn32@protonmail.com` successfully.
- **Changes:**
  - `src/services/email_service.py` — factory `create_email_service()` now activates `ResendEmailService` whenever `RESEND_API_KEY` is set (removed `is_production` guard); `ResendEmailService` default from_email changed to `noreply@notify.amoagou.com`.
  - `tests/test_abandoned_cart.py` — updated factory test for new behavior.
  - `scripts/test_resend_email.py` — updated to use `settings.resend_from_email` and send to real address.
  - New `scripts/setup_resend_domain.py` — creates Resend domains and prints DNS records for Namecheap.
- New `scripts/e2e_test_abandoned_cart.py` — seeds a cart + immediately processes it to verify full recovery pipeline (seed → query → stamp → commit → Resend API → email delivered).

## Completed 2026-07-14 — Fixed 41 Errors + 23 Failures → 201/201 Passing

**Root causes fixed:**

- **DB cleanup ordering** — 6 test files had `DELETE FROM variants` before clearing `purchase_order_items`, `cart_items`, `inventory`. Added proper FK-respecting cleanup order to `test_categories.py`, `test_collections.py`, `test_dashboard.py`, `test_orders.py`, `test_inventory.py`, `test_purchase_orders.py`.
- **Inventory price type** — Schema tests used `float` for price/cost; `InventoryVariantResponse` requires `int` (cents) and `cost` field.
- **Inventory create 422** — `seeded_item` fixture used `price: 19.99` float; changed to `price: 1999` int.
- **Orders list format** — Route returned `list[OrderResponse]` but tests expected `{"data": [...], "pagination": {...}}`. Wrapped in `PaginatedResponse` with proper count/sort/filter support.
- **Order state machine** — Validation via `validate_transition()` was defined but never wired into `PUT /orders/{id}`. Added it → invalid transitions now return 422.
- **Tenant middleware (dead code)** — `TenantMiddleware` class was defined but never registered on the app; removed it and its tests. Real tenant validation is via FastAPI `get_current_tenant_id` dependency.
- **Tenants CRUD** — `TenantCreate` schema doesn't include `tenant_id` (auto-generated); tests were passing an ignored UUID. Fixed tests to use the `tenant_id` from the response.
- **Purchase orders** — `sent_at`/`confirmed_at`/`closed_at` columns used `TIMESTAMP WITHOUT TIME ZONE` but code set timezone-aware datetimes. Added `sa_type=DateTime(timezone=True)` to model fields.
- **Purchase order test prices** — Used `19.99` float prices in order creation payloads; changed to `1999` int.

## Completed 2026-07-14 — Rate Limiter: Redis Swap

- **`src/core/throttle.py`** — Added `RedisRateLimiter` class implementing `RateLimiterProtocol` using Redis `INCR` + `TTL` with `rate:` key prefix. Factory `_create_limiter()` returns `RedisRateLimiter` when `redis_enabled` is True, otherwise falls back to `InMemoryRateLimiter`.
- **6 new tests** — Factory fallback test (in-memory when disabled, Redis when enabled), Redis `is_allowed` (first request, exceeded), `remaining()`, `reset_time()` with mocked Redis client.
- **All 207 tests passing.**

## Completed 2026-07-14 — Sentry Error Tracking

- **Backend** (`services/backend-api`): Added `sentry-sdk` with `FastApiIntegration` + `HttpxIntegration`, gated on `SENTRY_DSN` setting (Doppler). Initialized in `main.py` at startup (traces_sample_rate=0.1).
- **Admin** (`apps/admin`): Added `@sentry/nextjs@10.65.0`, created `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`.
- **Storefront** (`apps/storefront`): Same Sentry config files as admin.
- **Config:** `NEXT_PUBLIC_SENTRY_DSN` env var for frontend, `SENTRY_DSN` setting for backend. Session replays enabled (0.1 sample rate, 1.0 on error).
- **Backend init:** Only activates when `SENTRY_DSN` is set — no-op in dev/test. All 207 tests pass unchanged.

## Completed 2026-07-14 — CI Pipeline (GitHub Actions)

- **`.github/workflows/ci.yml`** — 4 jobs:
  - **Lint**: Ruff (Python import order), ESLint (admin + storefront)
  - **TypeCheck**: tsc --noEmit for admin + storefront
  - **Frontend Tests**: vitest run across all packages
  - **Backend Tests**: pytest with PostgreSQL service container, placeholders for required secrets
- Triggers on push/PR to `main`, cancels in-progress runs for same branch.

## Active Branch — `feat/product-form` (not yet merged to main)

- **Products page refactored** — sub-nav moved to main sidebar (Products expands with: All Products, Find Products to Sell, Add Product, Collections, Inventory, Transfers). View switching via URL params (`?view=add`, `?view=find`).
- **Add Product form** — full-page form with 4 sections: Details (title + TipTap WYSIWYG description), Media (drag-drop upload), Pricing (price, compare-at, cost), Variants (toggle + dynamic rows with option1/option2/price/SKU/stock).
- **Pending refinements** before merge to `main`:
  - Rich text editor needs further polish (toolbar positioning, keyboard shortcuts)
  - Variant management needs option-type selection (dropdown for Size/Color/Material instead of free-text inputs)
  - Media upload needs Cloudinary integration
  - Edit flow still uses old drawer — needs migration to full-page form
  - "Find Products to Sell" view is a placeholder
- **Sidebar note:** All placeholder nav groups (Analytics, Content, Sales Channels, Marketing, Discounts, Finances) intentionally kept — being built page by page.

## Key Decisions (All)

- Backend: 207 collected, all passing
- Tests use `jsdom` + `react()` plugin in vitest config; `cleanup()` in `afterEach` required for React tests
- `@repo/tenant-orm/schemas` (not `./schemas/tenant`) is the correct import for tenant schemas

- Backend: 169 collected, 145 passed, 12 pre-existing failures (inventory float→int, tenant middleware, tenants), 12 pre-existing errors (inventory/purchase-orders fixtures)
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
- Rate limiter is in-memory (no Redis dependency) — swap for Redis in production if needed
- Error tracking: console + sendBeacon to `/api/v1/public/errors` — swap for Sentry post-launch
- Cart cookie `Secure` flag determined by `location.protocol` at runtime (not build-time env)
- Order state machine follows `po_state_machine.py` pattern with `VALID_TRANSITIONS` dict and `validate_transition()` function
- Order status transitions: `pending→{confirmed,paid,cancelled}`, `confirmed→{paid,processing,shipped,cancelled}`, `paid→{processing,shipped,cancelled,refunded}`, `processing→{shipped,cancelled}`, `shipped→{delivered,cancelled,refunded}`, `delivered→{refunded}`, `cancelled/refunded` terminal
- `tests/conftest.py` inserts parent of `tests/` into sys.path (not `src/`) for `from src.xxx import` to work
- `CurrencyAwareRoute` extends `APIRoute` (not `Route` from Starlette) for FastAPI compatibility
- `CurrencyExtractorMiddleware` sets `request.state.target_currency` from X-Currency header or preferred_currency cookie
- Tenant `base_currency` is set per-route from `tenant.settings.get("currency", "GBP")` after `_resolve_tenant`
- Exchange rates cached in Redis by the `RateService` — no DB in the conversion path
- `_apply_rate` uses `ROUND_HALF_UP` quantize to nearest integer cent
- 24 interceptor unit tests run in <0.1s without Doppler (env vars via pytest inline overrides)

## Database Reseeding

- After any backend update involving models or schemas (new fields, new models, Alembic migrations), run the seed script to ensure test data matches the schema: `doppler run -- uv run python seed_database.py` from `services/backend-api/`
- The seed script is idempotent — it truncates all tenant-scoped data and re-seeds in a single transaction

## UI Design

- Always follow the UI design system when creating or reviewing components or pages
- Design system: @DESIGN.md

## Context

- Always follow the project context system when reviewing conflicting versions
- Context system: @PROJECT_CONTEXT.md
