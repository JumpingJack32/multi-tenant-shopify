# Sales Orders UI — Design Spec

## Overview

Build a production-ready Sales Orders management UI in the admin app. Backend is fully implemented; frontend needs types, API client, hooks, pages, and sidebar nav.

## Scope

### 1. Types (`packages/tenant-orm/src/types.ts`)

Replace the skinny `Order` and `OrderItem` interfaces with full versions matching the backend `OrderResponse`/`OrderItemResponse`:

```typescript
export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  shipping_address: Record<string, unknown>;
  billing_address: Record<string, unknown>;
  notes: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  discount: number;
  created_at: string;
}
```

Keep `DashboardRecentOrder` and `CustomerOrder` as-is (they're separate backend responses).

### 2. API Client Methods (`apps/admin/src/lib/api/client.ts`)

Add `api.orders` namespace:

```typescript
orders: {
  list: (params?: { page?: number; pageSize?: number; status?: string; search?: string }) =>
    request<OrderListResponse>("GET", "/orders", params),
  get: (id: string) =>
    request<Order>("GET", `/orders/${id}`),
  updateStatus: (id: string, data: { status?: string; payment_status?: string; tracking?: string }) =>
    request<Order>("PUT", `/orders/${id}`, data),
  getLinkedPOs: (id: string) =>
    request<AssociatedPO[]>("GET", `/orders/${id}/purchase-orders`),
}
```

### 3. Services & Hooks

```
apps/admin/src/features/orders/
  api/
    orders-service.ts    — fetchOrders, fetchOrder, updateOrderStatus, etc.
  hooks/
    use-orders.ts        — useOrders, useOrder, useUpdateOrderStatus
```

Pattern: identical to `purchase-orders-service.ts` / `use-purchase-orders.ts`. Accept optional `tenantId`, include in `queryKey`, set `enabled: !!tid`.

### 4. Sidebar Nav (`app-sidebar.tsx`)

Add "Orders" item in the Management zone, above Customers. Use `ShoppingCartIcon` from `lucide-react`.

### 5. Orders List Page (`/orders/page.tsx`)

Rip out the placeholder shell. Full implementation:

- Search input (filters by `order_number`, `customer_email`)
- Status filter tabs (All, Pending, Confirmed, Paid, Shipped, Delivered, Cancelled)
- Table with columns: Order #, Customer, Status (colored badge), Total (currency-aware), Date
- Pagination
- Loading: skeleton
- Empty: "No orders found" state
- Error: `ErrorBanner` with retry
- Click row → navigates to `/orders/{id}`

### 6. Order Detail Page (`/orders/[id]/page.tsx`)

Read-only view with action buttons per the Actions Matrix. Matches the PO detail page layout pattern.

**Layout** (2-column grid):

**Main (lg:col-span-2):**
- **Header**: order number (`font-mono`), status badge, created date, customer name link
- **Items Table**: table with columns: product name, SKU, variant, qty, unit price, total
- **Linked POs Panel**: card showing associated purchase orders (from `/orders/{id}/purchase-orders`). Each PO row shows `po_number` (link), status badge, supplier name, total.
- **Notes**: inline-editable textarea (if notes exist or empty state)

**Sidebar:**
- **Status Timeline**: colored dots for each status step (pending → confirmed → paid → processing → shipped → delivered)
- **Actions Card**: conditional buttons per the Actions Matrix below
- **Order Metadata Card**: customer email, payment method, shipping address summary, billing address summary

**Actions Matrix:**

| status / payment_status | Visible Buttons | API Call |
|---|---|---|
| unpaid / pending | Mark as Paid, Cancel | `PATCH` with `{ payment_status: "paid" }` or `{ status: "cancelled" }` |
| paid / confirmed | Ship Order (opens tracking input) | `PATCH` with `{ status: "shipped", tracking: "..." }` |
| paid / shipped | Mark as Delivered | `PATCH` with `{ status: "delivered" }` |
| Any (not cancelled) | Cancel Order, Refund | `PATCH` with `{ status: "cancelled" }` or `{ status: "refunded" }` |

**Backend**: Add a `PATCH /{order_id}` route delegating to the existing `update_order` logic (partial updates). The current `PUT` route remains for full-order writes.

### 7. Currency-Aware Formatting

All price displays should use the `Order.currency` field to determine the symbol. Create a utility:

```
packages/tenant-orm/src/utils.ts (or inline in components):
  function formatCurrency(amount: number, currency: string): string
```

```typescript
export function formatCurrency(cents: number, currencyCode: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}
```

Placed in `packages/tenant-orm/src/utils.ts`. Replaces ad-hoc `£{(n / 100).toFixed(2)}` patterns used in dashboard/PO code.

### 8. Linked POs on PO Detail Page

Already done in prior work — `source_order_number` badge linking to `/orders?search=ORD-XXXX`.

### Supporting Types

Add to `types.ts` alongside `Order` and `OrderItem`:

```typescript
export interface OrderListResponse {
  data: Order[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface AssociatedPO {
  id: string;
  po_number: string;
  status: string;
  supplier_name: string;
  total: number;
  fulfillment_strategy: string;
  created_at: string;
}
```

## Non-Goals

- No inline editing of order items (no quantity/price changes)
- No order creation from admin (handled via storefront)
- No bulk order operations
- No export/download

## Architecture

- All pages: `"use client"` with `useTenantContext()` for `currentTenantId`
- Data fetching: React Query via custom hooks, `enabled: !!tid` to wait for tenant
- Hook query keys: include both `tenantId` and entity `id` (e.g., `["orders", tenantId, id]`) for correct caching
- Actions: mutation hooks that call PATCH and invalidate query cache
- Patterns mirror suppliers/POs exactly for codebase consistency
