# Sales Orders UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Sales Orders management UI in the admin app — list page, detail page, API layer, sidebar nav.

**Architecture:** Backend is fully implemented. Frontend follows the exact patterns established by suppliers/POs: `"use client"` + `useTenantContext()` + React Query hooks with `enabled: !!tid` + read-only pages with discrete action buttons.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript, React Query (TanStack Query v5), shadcn/ui, lucide-react 1.20.0, FastAPI backend.

## Global Constraints

- All prices are integer cents, divide by 100 for display
- UUIDs are `string` type throughout (never `UUID` in frontend code)
- `X-Tenant-ID` header required for all backend calls
- All hooks accept optional `tenantId` param; fall back to `sessionStorage` via `getStorageTenantId()`
- Query keys include both `tenantId` and entity `id` for correct caching
- `"use client"` directive on all interactive pages

---
### Task 1: Backend — Add PATCH endpoint + customer info in OrderResponse

**Files:**
- Modify: `services/backend-api/src/routes/orders.py`
- Modify: `services/backend-api/src/orm/schemas/order.py`

**Interfaces:**
- Produces: `customer_email: Optional[str]` field on `OrderResponse` schema; `PATCH /{order_id}` endpoint

- [ ] **Step 1: Add `customer_email` to OrderResponse schema**

In `services/backend-api/src/orm/schemas/order.py`, add a field to `OrderResponse`:

```python
customer_email: Optional[str] = None
```

- [ ] **Step 2: Populate customer_email in list_orders and get_order**

In `services/backend-api/src/routes/orders.py`, update the `list_orders` query to join customer info:

```python
# Add this import if not present
from sqlalchemy.orm import joinedload

# Change the query to:
stmt = (
    select(Order)
    .options(joinedload(Order.customer), selectinload(Order.items))
    .where(Order.tenant_id == tenant_id)
    .order_by(Order.created_at.desc())
)
result = await db.exec(stmt)
orders = result.unique().scalars().all()
```

And in the response mapping for both `list_orders` and `get_order`, populate the email:

```python
# In list_orders response
return [
    OrderResponse(
        **order.model_dump(),
        customer_email=order.customer.email if order.customer else None,
        items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
    )
    for order in orders
]

# In get_order response
return OrderResponse(
    **order.model_dump(),
    customer_email=order.customer.email if order.customer else None,
    items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
)
```

- [ ] **Step 3: Add PATCH route**

Add immediately after the existing `PUT` route:

```python
@router.patch("/{order_id}", response_model=OrderResponse)
async def patch_order(
    order_id: UUID,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    return await update_order(order_id, order_data, db, tenant_id)
```

This delegates to the same `update_order` function — `OrderUpdate` uses all-Optional fields so partial payloads work.

- [ ] **Step 4: Verify server starts**

```bash
cd services/backend-api && DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres" .venv/bin/uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload &
sleep 3
curl -s http://localhost:8000/api/v1/tenants/ | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin))} tenants')"
```

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/routes/orders.py services/backend-api/src/orm/schemas/order.py
git commit -m "feat: add order customer_email, PATCH endpoint for status transitions"
```

---
### Task 2: Types — Update Order/OrderItem + add OrderListResponse

**Files:**
- Modify: `packages/tenant-orm/src/types.ts`

**Interfaces:**
- Produces: `Order`, `OrderItem`, `OrderListResponse`, `AssociatedPO` (used by Tasks 3-7)

- [ ] **Step 1: Replace the skinny `Order` interface**

Find the existing `Order` interface (around line 87) and replace it:

```typescript
export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  customer_email: string | null;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  payment_intent_id: string | null;
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
```

- [ ] **Step 2: Replace the skinny `OrderItem` interface**

Find the existing `OrderItem` interface and replace it:

```typescript
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

- [ ] **Step 3: Add `OrderListResponse` and `AssociatedPO`**

Append after `PurchaseOrderListResponse`:

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

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit -p packages/tenant-orm/tsconfig.json
Expected: no errors
```

- [ ] **Step 5: Commit**

```bash
git add packages/tenant-orm/src/types.ts
git commit -m "feat(types): expand Order/OrderItem types, add OrderListResponse and AssociatedPO"
```

---
### Task 3: API Client — Add orders namespace

**Files:**
- Modify: `apps/admin/src/lib/api/client.ts`

**Interfaces:**
- Consumes: `Order`, `OrderListResponse`, `AssociatedPO` types from Task 2
- Produces: `api.orders` namespace (used by Tasks 4-7)

- [ ] **Step 1: Add Order/OrderListResponse/AssociatedPO to the type imports**

Find the import block at the top and add:

```typescript
import type {
  AssociatedPO,
  Order,
  OrderListResponse,
  ...existing imports
} from "@repo/tenant-orm/types";
```

- [ ] **Step 2: Add `api.orders` before `api.inventory`**

```typescript
  orders: {
    list(
      params?: Record<string, string>,
      options?: { tenantId?: string | null },
    ) {
      return request<OrderListResponse>(
        "/orders" + buildQuery(params),
        options ?? {},
      );
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<Order>("/orders/" + id, options ?? {});
    },
    updateStatus(
      id: string,
      data: Record<string, unknown>,
      options?: { tenantId?: string | null },
    ) {
      return request<Order>("/orders/" + id, {
        method: "PATCH",
        body: JSON.stringify(data),
        ...options,
      });
    },
    getLinkedPOs(id: string, options?: { tenantId?: string | null }) {
      return request<AssociatedPO[]>(
        "/orders/" + id + "/purchase-orders",
        options ?? {},
      );
    },
  },
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit -p apps/admin/tsconfig.json
Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/api/client.ts
git commit -m "feat(api): add orders namespace with list/get/updateStatus/getLinkedPOs"
```

---
### Task 4: Currency Utility — formatCurrency

**Files:**
- Create: `packages/tenant-orm/src/utils.ts`

**Interfaces:**
- Produces: `formatCurrency(cents, currencyCode)` (used by Tasks 6-7)

- [ ] **Step 1: Create utils.ts**

```typescript
export function formatCurrency(
  cents: number,
  currencyCode: string = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(cents / 100);
}
```

- [ ] **Step 2: Verify the package builds**

```bash
npx tsc --noEmit -p packages/tenant-orm/tsconfig.json
Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add packages/tenant-orm/src/utils.ts
git commit -m "feat: add formatCurrency utility (Intl.NumberFormat, cents/100)"
```

---
### Task 5: Orders Service + Hooks

**Files:**
- Create: `apps/admin/src/features/orders/api/orders-service.ts`
- Create: `apps/admin/src/features/orders/hooks/use-orders.ts`

**Interfaces:**
- Consumes: `api.orders`, types from Task 2
- Produces: `fetchOrders`, `fetchOrder`, `updateOrderStatus`, `fetchOrderLinkedPOs` service functions + `useOrders`, `useOrder`, `useUpdateOrderStatus` hooks (used by Tasks 6-7)

- [ ] **Step 1: Create `orders-service.ts`**

```typescript
import type { AssociatedPO, Order, OrderListResponse } from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return (
      (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem(
        "admin_selected_tenant",
      ) ?? null
    );
  } catch {
    return null;
  }
}

export async function fetchOrders(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<OrderListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.orders.list(params, { tenantId: tid });
}

export async function fetchOrder(
  id: string,
  tenantId?: string | null,
): Promise<Order> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.get(id, { tenantId: tid });
}

export async function updateOrderStatus(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Order> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.updateStatus(id, data, { tenantId: tid });
}

export async function fetchOrderLinkedPOs(
  id: string,
  tenantId?: string | null,
): Promise<AssociatedPO[]> {
  const tid = tenantId ?? getStorageTenantId();
  return api.orders.getLinkedPOs(id, { tenantId: tid });
}
```

- [ ] **Step 2: Create `use-orders.ts`**

```typescript
import type { AssociatedPO, Order, OrderListResponse } from "@repo/tenant-orm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchOrder,
  fetchOrderLinkedPOs,
  fetchOrders,
  updateOrderStatus,
} from "../api/orders-service";

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    return (
      (globalThis as { sessionStorage?: Storage }).sessionStorage?.getItem(
        "admin_selected_tenant",
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function useOrders(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<OrderListResponse>({
    queryKey: ["orders", params, tid],
    queryFn: () => fetchOrders(params, tid),
    enabled: !!tid,
  });
}

export function useOrder(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<Order>({
    queryKey: ["order", id, tid],
    queryFn: () => fetchOrder(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useUpdateOrderStatus(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateOrderStatus(id, data, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order"] });
    },
  });
}

export function useOrderLinkedPOs(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<AssociatedPO[]>({
    queryKey: ["order-linked-pos", id, tid],
    queryFn: () => fetchOrderLinkedPOs(id, tid),
    enabled: !!tid && !!id,
  });
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit -p apps/admin/tsconfig.json
Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/features/orders/
git commit -m "feat: add orders service + hooks (useOrders, useOrder, useUpdateOrderStatus, useOrderLinkedPOs)"
```

---
### Task 6: Sidebar — Add Orders nav item

**Files:**
- Modify: `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`

- [ ] **Step 1: Add `ReceiptIcon` to imports**

Find the lucide-react icon imports and add:

```typescript
  ReceiptIcon,
```

- [ ] **Step 2: Add Orders to navManagement**

Insert before `{ title: "Customers" ... }`:

```typescript
  { title: "Orders", url: "/orders", icon: <ReceiptIcon /> },
```

The navManagement array should now look like:

```typescript
const navManagement: NavItem[] = [
  {
    title: "Products",
    icon: <PackageIcon />,
    items: [
      { title: "Collections", url: "/collections" },
      { title: "Inventory", url: "/products/inventory" },
      { title: "Transfers", url: "/products/transfers" },
      { title: "Gift Cards", url: "/products/gift-cards" },
    ],
  },
  {
    title: "Content",
    icon: <FileTextIcon />,
    items: [
      { title: "Pages", url: "/content/pages" },
      { title: "Blog Posts", url: "/content/blog" },
      { title: "Files & Media Library", url: "/content/files" },
      { title: "Metafields", url: "/content/metafields" },
    ],
  },
  { title: "Orders", url: "/orders", icon: <ReceiptIcon /> },
  { title: "Customers", url: "/customers", icon: <UsersIcon /> },
];
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit -p packages/ui/tsconfig.json
Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/blocks/dashboard/app-sidebar.tsx
git commit -m "feat(sidebar): add Orders nav item with ReceiptIcon"
```

---
### Task 7: Orders List Page

**Files:**
- Modify: `apps/admin/src/app/(app)/orders/page.tsx` (replace placeholder shell)
- Create: `apps/admin/src/components/orders/orders-table.tsx` (replace existing placeholder)

**Interfaces:**
- Consumes: `useOrders` hook from Task 5
- Depends on: Task 4 (`formatCurrency`), Task 5 (hooks), Task 6 (sidebar), Task 2 (types)

- [ ] **Step 1: Replace `apps/admin/src/app/(app)/orders/page.tsx`**

```tsx
"use client";

import { Skeleton } from "@repo/ui/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OrdersTable } from "@/components/orders/orders-table";
import { ErrorBanner } from "@/components/shared/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { useOrders } from "@/features/orders/hooks/use-orders";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Paid", value: "paid" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

export default function OrdersPage() {
  const router = useRouter();
  const { currentTenantId, tenantLoading } = useTenantContext();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), page_size: "20" };
  if (statusFilter) params.status = statusFilter;
  if (search) params.search = search;

  const { data, isLoading, isError, error, refetch } = useOrders(
    params,
    currentTenantId,
  );

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorBanner
          message={(error as Error)?.message ?? "Failed to load orders"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/dashboard")}
        >
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const orders = data?.data ?? [];
  const pagination = data?.pagination ?? { page: 1, page_size: 20, total: 0, total_pages: 0 };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Orders</h1>
      </div>

      {/* Search + Status Tabs */}
      <div className="mb-4 space-y-3">
        <input
          type="text"
          placeholder="Search by order number or customer..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-md border ${
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <OrdersTable
        orders={orders}
        onRowClick={(id) => router.push(`/orders/${id}`)}
      />

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page >= pagination.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: need to import `Button` from `@repo/ui/components/ui/button`.

- [ ] **Step 2: Replace `apps/admin/src/components/orders/orders-table.tsx`**

```tsx
import type { Order } from "@repo/tenant-orm/types";

import { Badge } from "@repo/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";

import { formatCurrency } from "@repo/tenant-orm/utils";

const STATUS_VARIANTS: Record<string, string> = {
  pending: "secondary",
  confirmed: "outline",
  paid: "default",
  processing: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

interface OrdersTableProps {
  orders: Order[];
  onRowClick: (id: string) => void;
}

export function OrdersTable({ orders, onRowClick }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No orders found
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onRowClick(order.id)}
          >
            <TableCell className="font-mono text-sm">
              {order.order_number}
            </TableCell>
            <TableCell>
              {order.customer_email ?? "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  (STATUS_VARIANTS[order.status] as
                    | "default"
                    | "secondary"
                    | "destructive"
                    | "outline") ?? "outline"
                }
              >
                {order.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{order.payment_status}</Badge>
            </TableCell>
            <TableCell className="font-mono">
              {formatCurrency(order.total, order.currency)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {new Date(order.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit -p apps/admin/tsconfig.json
Expected: no errors
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/app/\(app\)/orders/page.tsx apps/admin/src/components/orders/orders-table.tsx
git commit -m "feat: orders list page with search, status filters, pagination"
```

---
### Task 8: Order Detail Page

**Files:**
- Create: `apps/admin/src/app/(app)/orders/[id]/page.tsx`

**Interfaces:**
- Consumes: `useOrder`, `useUpdateOrderStatus`, `useOrderLinkedPOs` from Task 5, `formatCurrency` from Task 4

- [ ] **Step 1: Create the detail page**

```tsx
"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import { formatCurrency } from "@repo/tenant-orm/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";

import { ErrorBanner } from "@/components/shared/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useOrder,
  useOrderLinkedPOs,
  useUpdateOrderStatus,
} from "@/features/orders/hooks/use-orders";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const STATUS_VARIANTS: Record<string, string> = {
  pending: "secondary",
  confirmed: "outline",
  paid: "default",
  processing: "secondary",
  shipped: "secondary",
  delivered: "default",
  cancelled: "destructive",
  refunded: "destructive",
};

const STATUS_ORDER = [
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { currentTenantId, tenantLoading } = useTenantContext();
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: order, isLoading, isError, error, refetch } = useOrder(
    id,
    currentTenantId,
  );
  const { data: linkedPOs } = useOrderLinkedPOs(id, currentTenantId);
  const updateStatus = useUpdateOrderStatus(currentTenantId);

  const handleAction = async (data: Record<string, unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ id, data });
      refetch();
    } catch (err) {
      setActionError((err as Error)?.message ?? "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (tenantLoading || isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <ErrorBanner
          message={(error as Error)?.message ?? "Failed to load order"}
          onRetry={() => refetch()}
        />
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/orders")}
        >
          Back to Orders
        </Button>
      </div>
    );
  }

  if (!order) return null;

  const currentIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">
              {order.order_number}
            </h1>
            <Badge
              variant={
                (STATUS_VARIANTS[order.status] as
                  | "default"
                  | "secondary"
                  | "destructive"
                  | "outline") ?? "outline"
              }
            >
              {STATUS_LABELS[order.status] ?? order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Created {new Date(order.created_at).toLocaleDateString()}
            {order.customer_email && <> &middot; {order.customer_email}</>}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/orders")}
        >
          Back to Orders
        </Button>
      </div>

      {actionError && <ErrorBanner message={actionError} />}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items + Linked POs + Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.sku || "—"}
                      </TableCell>
                      <TableCell>{item.variant_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.unit_price, order.currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.total_price, order.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Linked POs */}
          {linkedPOs && linkedPOs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Procurement</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO Number</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedPOs.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>
                          <Link
                            href={`/purchase-orders/${po.id}`}
                            className="font-mono text-sm underline underline-offset-2 hover:text-foreground"
                          >
                            {po.po_number}
                          </Link>
                        </TableCell>
                        <TableCell>{po.supplier_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{po.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(po.total, "USD")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {order.notes || "No notes"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar: Timeline + Actions + Metadata */}
        <div className="space-y-6">
          {/* Status Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {STATUS_ORDER.map((s, idx) => {
                const isPast = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isCancelled = order.status === "cancelled";
                const dotColor = isCancelled
                  ? "bg-destructive"
                  : isCurrent
                    ? "bg-primary"
                    : isPast
                      ? "bg-primary/60"
                      : "bg-muted-foreground/20";
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${dotColor}`}
                    />
                    <span
                      className={`text-sm ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : isPast || isCancelled
                            ? "text-muted-foreground"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {STATUS_LABELS[s] ?? s}
                    </span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-xs ml-auto">
                        Current
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.status === "pending" && order.payment_status === "unpaid" && (
                <>
                  <Button
                    className="w-full"
                    disabled={actionLoading}
                    onClick={() => handleAction({ payment_status: "paid" })}
                  >
                    Mark as Paid
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={actionLoading}
                    onClick={() => handleAction({ status: "cancelled" })}
                  >
                    Cancel Order
                  </Button>
                </>
              )}
              {order.status === "confirmed" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "shipped" })}
                >
                  Ship Order
                </Button>
              )}
              {order.status === "shipped" && (
                <Button
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "delivered" })}
                >
                  Mark as Delivered
                </Button>
              )}
              {order.status !== "cancelled" && order.status !== "delivered" && order.status !== "refunded" && order.status !== "pending" && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "cancelled" })}
                >
                  Cancel Order
                </Button>
              )}
              {(order.status === "delivered" || order.status === "shipped") && (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={actionLoading}
                  onClick={() => handleAction({ status: "refunded" })}
                >
                  Refund
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span>{order.payment_method ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">
                  {formatCurrency(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-mono">
                  {formatCurrency(order.tax, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-mono">
                  {formatCurrency(order.shipping, order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount
                </span>
                <span className="font-mono">
                  {order.discount > 0
                    ? `-${formatCurrency(order.discount, order.currency)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total</span>
                <span className="font-mono">
                  {formatCurrency(order.total, order.currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit -p apps/admin/tsconfig.json
Expected: no errors
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(app\)/orders/\[id\]/page.tsx
git commit -m "feat: order detail page with items, timeline, actions, linked POs"
```

---
### Task 9: E2E Smoke Test

- [ ] **Step 1: Verify backend is running**

```bash
curl -s http://localhost:8000/api/v1/tenants/ | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"
Expected: 3 (or however many tenants exist)
```

- [ ] **Step 2: Test list orders**

```bash
TID="42497577-330b-46ba-bffb-e56b2caf388b"
curl -s -H "X-Tenant-ID: $TID" http://localhost:8000/api/v1/orders | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} orders')"
```

- [ ] **Step 3: Test single order**

```bash
ORDER_ID=$(curl -s -H "X-Tenant-ID: $TID" http://localhost:8000/api/v1/orders | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
curl -s -H "X-Tenant-ID: $TID" "http://localhost:8000/api/v1/orders/$ORDER_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Order: {d[\"order_number\"]}, items: {len(d.get(\"items\",[]))}')"
```

- [ ] **Step 4: Test PATCH endpoint**

```bash
curl -s -X PATCH -H "X-Tenant-ID: $TID" -H "Content-Type: application/json" -d '{"status":"confirmed"}' "http://localhost:8000/api/v1/orders/$ORDER_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Updated: {d[\"order_number\"]} -> {d[\"status\"]}')"
```

- [ ] **Step 5: Test SO↔PO cross-link**

```bash
curl -s -H "X-Tenant-ID: $TID" "http://localhost:8000/api/v1/orders/ef730146-cd81-429e-8dae-660b7dd6eb1a/purchase-orders" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} linked PO(s)')"
```

- [ ] **Step 6: Run admin test suite**

```bash
pnpm test --filter @repo/admin
Expected: 20 tests passed
```

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit -p apps/admin/tsconfig.json
Expected: no errors
```
