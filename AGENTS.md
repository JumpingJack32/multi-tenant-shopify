# Session Context — Saved 2026-07-12 (Storefront Currency Switcher — Merged)

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

## Pending — Next Session

- **Abandoned Cart Recovery** — post-launch optimization
- Admin detail page tests (the `[id]/page.tsx` order detail page)
- Lint + typecheck verification (backend)

## Key Decisions (All)

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

## UI Design

- Always follow the UI design system when creating or reviewing components or pages
- Design system: @DESIGN.md

## Context

- Always follow the project context system when reviewing conflicting versions
- Context system: @PROJECT_CONTEXT.md
