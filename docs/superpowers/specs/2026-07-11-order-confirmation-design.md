# Order Confirmation Page — Design Spec

## Problem

After a customer completes checkout on the storefront, they need a confirmation page showing order details. The cart drawer currently navigates to `/{tenant}/checkout` — a page that doesn't exist.

## Approach

**Option A: Backend endpoint + confirmation page (selected)**

Add a tenant-scoped `GET /{tenant_slug}/orders/{order_id}` endpoint to the storefront API, then build a confirmation page that fetches the order. This survives page refresh and enables future features (order history, shareable links).

## Architecture

### Backend

**New endpoint**: `GET /api/v1/storefront/{tenant_slug}/orders/{order_id}`

- Tenant-scoped: `WHERE Order.id == order_id AND Order.tenant_id == tenant.tenant_id`
- Eager-loads `Order.items`
- Returns `OrderResponse` (existing schema)
- Returns 404 if not found

**File**: `services/backend-api/src/routes/storefront.py`

### Frontend

**API client**: `fetchOrder(tenantSlug, orderId) -> OrderResponse | null` in `storefront-api.ts`

**Hook**: `useOrder(orderId)` in `use-orders.ts` — TanStack Query with key `["order", tenantSlug, orderId]`, enabled only when both are present.

**Cart drawer update**: The CHECKOUT button now calls `useCheckout()` mutation. On success, redirects to `/{tenant}/order-confirmation/{order.id}`. Shows spinner while processing.

**Confirmation page**: `apps/storefront/src/app/[tenant]/order-confirmation/[orderId]/page.tsx`

- Server component: fetches order via `fetchOrder`, calls `notFound()` if null
- Displays: order number, date, item list with quantities/prices, subtotal/tax/shipping/total breakdown
- Uses design system fonts (font-heading for title, font-mono for prices/labels)
- "Continue Shopping" link back to products page

## Data Flow

1. User clicks CHECKOUT in cart drawer
2. `useCheckout` mutation calls `POST /{slug}/carts/{id}/checkout`
3. Backend validates stock, creates order, clears cart, returns `OrderResponse`
4. On success: close drawer, `router.push` to `/{tenant}/order-confirmation/{order.id}`
5. Confirmation page server-fetches order via `GET /{slug}/orders/{order_id}`
6. Renders order details — survives refresh

## Files Changed

| File                                                                     | Change                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `services/backend-api/src/routes/storefront.py`                          | Added `GET /{tenant_slug}/orders/{order_id}` endpoint |
| `apps/storefront/src/lib/storefront-api.ts`                              | Added `fetchOrder()` function                         |
| `apps/storefront/src/hooks/use-orders.ts`                                | New file: `useOrder()` TanStack Query hook            |
| `apps/storefront/src/components/storefront/cart-drawer.tsx`              | CHECKOUT button now calls `useCheckout()` + redirects |
| `apps/storefront/src/app/[tenant]/order-confirmation/[orderId]/page.tsx` | New: server component confirmation page               |

## Verification

- Lint: clean (`pnpm lint --filter @repo/storefront -- --fix`)
- Typecheck: clean (`pnpm typecheck --filter @repo/storefront`)
- Tests: 31/31 storefront tests pass
