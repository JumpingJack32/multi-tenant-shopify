# Purchase Order Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin frontend for the Purchase Order system: suppliers CRUD, PO list/queue/detail, sidebar nav, dashboard card, and SO-PO cross-linking.

**Architecture:** Extends existing admin patterns — feature service files under `src/features/*/api/`, React Query hooks under `src/features/*/hooks/`, page components under `src/app/(app)/`, shared components under `src/components/`. Sidebar config in `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`.

**Tech Stack:** Next.js App Router, shadcn/ui, React Query, lucide-react icons, Tailwind v4.

## Global Constraints

- All new files follow existing patterns exactly (see `features/dashboard/`, `features/inventory/`, `components/inventory/`)
- Colocate: service layer (`api/`), hooks, and feature components under `features/<name>/`
- Shared components go under `src/components/<name>/` (no `features/` subfolder)
- Prices in pence (int), display as `LB{(n / 100).toFixed(2)}`
- All pages use `"use client"` and `useTenantContext()` for tenant ID
- All queries guarded with `enabled: !!tid`
- `NEXT_PUBLIC_API_URL` or fallback `http://localhost:8000` in `client.ts`

---

## Readiness Check

```bash
TENANT_ID=$(curl -s http://localhost:8000/api/v1/tenants/ | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')
curl -s "http://localhost:8000/api/v1/suppliers" -H "X-Tenant-ID: $TENANT_ID" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"Suppliers: {d.get(\"pagination\",{}).get(\"total\",0)}")'
```

---

## Task Dependency Graph

```
Task 1 (types + client) --> Task 2 (suppliers service+hooks) --> Task 4 (suppliers page)
                       --> Task 3 (POs service+hooks) --> Task 5 (POs list page)
                                                        --> Task 6 (PO detail page)
Task 7 (sidebar nav) --> (independent, no deps)
Task 8 (dashboard card) --> (depends on Task 1 types)
Task 9 (orders PO section) --> (depends on Task 1 types + Task 3)
```

---

## File Map

```
# Modified existing files
apps/admin/src/lib/api/client.ts                           - add suppliers.*, purchaseOrders.*
apps/admin/src/app/(app)/dashboard/page.tsx                 - add Pending PO card
apps/admin/src/app/(app)/orders/page.tsx                    - add procurement status per order
packages/tenant-orm/src/types.ts                            - add Supplier, PO, PendingPOStats types
packages/ui/src/components/blocks/dashboard/app-sidebar.tsx - reorder Products, add Suppliers, divider

# New files - API layer
apps/admin/src/features/suppliers/api/suppliers-service.ts
apps/admin/src/features/suppliers/hooks/use-suppliers.ts
apps/admin/src/features/purchase-orders/api/purchase-orders-service.ts
apps/admin/src/features/purchase-orders/hooks/use-purchase-orders.ts

# New files - Pages
apps/admin/src/app/(app)/products/suppliers/page.tsx
apps/admin/src/app/(app)/products/purchase-orders/page.tsx
apps/admin/src/app/(app)/products/purchase-orders/[id]/page.tsx

# New files - Components
apps/admin/src/components/suppliers/suppliers-table.tsx
apps/admin/src/components/suppliers/supplier-dialog.tsx
apps/admin/src/components/purchase-orders/purchase-orders-table.tsx
apps/admin/src/components/purchase-orders/po-approve-modal.tsx
apps/admin/src/components/purchase-orders/po-detail.tsx
apps/admin/src/components/purchase-orders/po-items-table.tsx
apps/admin/src/components/purchase-orders/po-tracking-card.tsx
apps/admin/src/components/purchase-orders/po-timeline.tsx
```

---

### Task 1: Types + API Client Methods

**Files:**

- Modify: `packages/tenant-orm/src/types.ts`
- Modify: `apps/admin/src/lib/api/client.ts`

- [ ] **Step 1: Add types to `packages/tenant-orm/src/types.ts`**

Add these after `DashboardRecentOrder` / before the closing of the file:

```typescript
export interface PendingPOStats {
  count: number;
  total: number;
}

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  delivery_method: string;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SupplierListResponse {
  data: Supplier[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  variant_id: string;
  supplier_sku: string | null;
  product_name: string;
  variant_label: string;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  received_quantity: number | null;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: string;
  fulfillment_strategy: string;
  ship_to_address_snapshot: Record<string, unknown> | null;
  tracking_number: string | null;
  carrier: string | null;
  subtotal: number;
  tax: number;
  shipping_cost: number;
  total: number;
  notes: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  closed_at: string | null;
  items: PurchaseOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}
```

Add `pending_pos` to `DashboardSummary`:

```typescript
export interface DashboardSummary {
  // ... existing fields stay as-is ...
  pending_pos: PendingPOStats;
}
```

- [ ] **Step 2: Add API methods to `apps/admin/src/lib/api/client.ts`**

Add imports at the top:

```typescript
import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
  Supplier,
  SupplierListResponse,
} from "@repo/tenant-orm/types";
```

Add to the `api` object before the closing `};`:

```typescript
  suppliers: {
    list(params?: Record<string, string>, options?: { tenantId?: string | null }) {
      return request<SupplierListResponse>("/suppliers" + buildQuery(params), options ?? {});
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<Supplier>("/suppliers/" + id, options ?? {});
    },
    create(data: Record<string, unknown>, options?: { tenantId?: string | null }) {
      return request<Supplier>("/suppliers", { method: "POST", body: JSON.stringify(data), ...options });
    },
    update(id: string, data: Record<string, unknown>, options?: { tenantId?: string | null }) {
      return request<Supplier>("/suppliers/" + id, { method: "PATCH", body: JSON.stringify(data), ...options });
    },
    delete(id: string, options?: { tenantId?: string | null }) {
      return request<void>("/suppliers/" + id, { method: "DELETE", ...options });
    },
  },

  purchaseOrders: {
    list(params?: Record<string, string>, options?: { tenantId?: string | null }) {
      return request<PurchaseOrderListResponse>("/purchase-orders" + buildQuery(params), options ?? {});
    },
    get(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id, options ?? {});
    },
    approve(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/approve", { method: "POST", ...options });
    },
    cancel(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/cancel", { method: "POST", ...options });
    },
    updateTracking(id: string, data: Record<string, unknown>, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id, { method: "PATCH", body: JSON.stringify(data), ...options });
    },
    markConfirmed(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/confirm", { method: "POST", ...options });
    },
    markInTransit(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/in-transit", { method: "POST", ...options });
    },
    markClosed(id: string, options?: { tenantId?: string | null }) {
      return request<PurchaseOrder>("/purchase-orders/" + id + "/close", { method: "POST", ...options });
    },
    batchApprove(ids: string[], options?: { tenantId?: string | null }) {
      return request<{ approved: number }>("/purchase-orders/batch/approve", { method: "POST", body: JSON.stringify({ ids }), ...options });
    },
  },
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add packages/tenant-orm/src/types.ts apps/admin/src/lib/api/client.ts
git commit -m "feat(admin): add supplier/PO types and API client methods"
```

---

### Task 2: Suppliers Service + Hooks

**Files:**

- Create: `apps/admin/src/features/suppliers/api/suppliers-service.ts`
- Create: `apps/admin/src/features/suppliers/hooks/use-suppliers.ts`

- [ ] **Step 1: Create service file**

```typescript
// apps/admin/src/features/suppliers/api/suppliers-service.ts
import type { Supplier, SupplierListResponse } from "@repo/tenant-orm/types";

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

export async function fetchSuppliers(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<SupplierListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.suppliers.list(params, { tenantId: tid });
}

export async function fetchSupplier(
  id: string,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.get(id, { tenantId: tid });
}

export async function createSupplier(
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.create(data, { tenantId: tid });
}

export async function updateSupplier(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<Supplier> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.update(id, data, { tenantId: tid });
}

export async function deleteSupplier(
  id: string,
  tenantId?: string | null,
): Promise<void> {
  const tid = tenantId ?? getStorageTenantId();
  return api.suppliers.delete(id, { tenantId: tid });
}
```

- [ ] **Step 2: Create hooks file**

```typescript
// apps/admin/src/features/suppliers/hooks/use-suppliers.ts
import type { Supplier, SupplierListResponse } from "@repo/tenant-orm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSupplier,
  deleteSupplier,
  fetchSupplier,
  fetchSuppliers,
  updateSupplier,
} from "../api/suppliers-service";

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

export function useSuppliers(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<SupplierListResponse>({
    queryKey: ["suppliers", params, tid],
    queryFn: () => fetchSuppliers(params, tid),
    enabled: !!tid,
  });
}

export function useSupplier(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<Supplier>({
    queryKey: ["supplier", id, tid],
    queryFn: () => fetchSupplier(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useCreateSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createSupplier(data, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useUpdateSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateSupplier(id, data, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}

export function useDeleteSupplier(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });
}
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/features/suppliers/
git commit -m "feat(admin): add suppliers service and hooks"
```

---

### Task 3: Purchase Orders Service + Hooks

**Files:**

- Create: `apps/admin/src/features/purchase-orders/api/purchase-orders-service.ts`
- Create: `apps/admin/src/features/purchase-orders/hooks/use-purchase-orders.ts`

- [ ] **Step 1: Create service file**

```typescript
// apps/admin/src/features/purchase-orders/api/purchase-orders-service.ts
import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
} from "@repo/tenant-orm/types";

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

export async function fetchPOs(
  params?: Record<string, string>,
  tenantId?: string | null,
): Promise<PurchaseOrderListResponse> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid)
    return {
      data: [],
      pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 },
    };
  return api.purchaseOrders.list(params, { tenantId: tid });
}

export async function fetchPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.get(id, { tenantId: tid });
}

export async function approvePO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.approve(id, { tenantId: tid });
}

export async function cancelPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.cancel(id, { tenantId: tid });
}

export async function updatePOTracking(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.updateTracking(id, data, { tenantId: tid });
}

export async function confirmPO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markConfirmed(id, { tenantId: tid });
}

export async function markPOInTransit(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markInTransit(id, { tenantId: tid });
}

export async function closePO(
  id: string,
  tenantId?: string | null,
): Promise<PurchaseOrder> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.markClosed(id, { tenantId: tid });
}

export async function batchApprovePOs(
  ids: string[],
  tenantId?: string | null,
): Promise<{ approved: number }> {
  const tid = tenantId ?? getStorageTenantId();
  return api.purchaseOrders.batchApprove(ids, { tenantId: tid });
}
```

- [ ] **Step 2: Create hooks file**

```typescript
// apps/admin/src/features/purchase-orders/hooks/use-purchase-orders.ts
import type {
  PurchaseOrder,
  PurchaseOrderListResponse,
} from "@repo/tenant-orm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approvePO,
  batchApprovePOs,
  cancelPO,
  closePO,
  confirmPO,
  fetchPO,
  fetchPOs,
  markPOInTransit,
  updatePOTracking,
} from "../api/purchase-orders-service";

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

export function usePOs(
  params?: Record<string, string>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<PurchaseOrderListResponse>({
    queryKey: ["purchase-orders", params, tid],
    queryFn: () => fetchPOs(params, tid),
    enabled: !!tid,
  });
}

export function usePO(id: string, tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery<PurchaseOrder>({
    queryKey: ["purchase-order", id, tid],
    queryFn: () => fetchPO(id, tid),
    enabled: !!tid && !!id,
  });
}

export function useApprovePO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => approvePO(id, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelPO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => cancelPO(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useUpdatePOTracking(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updatePOTracking(id, data, tid),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["purchase-order", vars.id] }),
  });
}

export function useConfirmPO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => confirmPO(id, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useMarkPOInTransit(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => markPOInTransit(id, tid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useClosePO(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (id: string) => closePO(id, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBatchApprovePOs(tenantId?: string | null) {
  const qc = useQueryClient();
  const tid = tenantId ?? getStorageTenantId();
  return useMutation({
    mutationFn: (ids: string[]) => batchApprovePOs(ids, tid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/features/purchase-orders/
git commit -m "feat(admin): add purchase orders service and hooks"
```

---

### Task 4: Sidebar Navigation Update

**Files:**

- Modify: `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`

- [ ] **Step 1: Update the Products sub-items**

Reorder the Products sub-items and add Suppliers. Add a `Separator` component between Inventory and Purchase Orders:

```typescript
// Imports at top — add Separator:
import { Separator } from "@repo/ui/components/ui/separator";
```

Update the Products nav items in the middle zone:

```typescript
// Replace the existing Products items block (around line 73-84)
const navManagement: NavItem[] = [
  {
    title: "Products",
    icon: <PackageIcon />,
    items: [
      { title: "Products List", url: "/products" },
      { title: "Collections", url: "/collections" },
      { title: "Inventory", url: "/products/inventory" },
    ],
  },
  // ... Content, Customers stay as-is
];
```

Add a new Procurement section below Management with a Separator:

```typescript
// After the NavMain for Management, add:
<Separator className="my-2" />

<NavMain
  items={navProcurement}
  label="Procurement"
  LinkComponent={LinkComponent}
/>
```

Define `navProcurement` array:

```typescript
const navProcurement: NavItem[] = [
  {
    title: "Purchase Orders",
    icon: <PackageIcon />,
    url: "/products/purchase-orders",
  },
  {
    title: "Suppliers",
    icon: <UsersIcon />,
    url: "/products/suppliers",
  },
];
```

---

### Task 5: Suppliers Page + Components

**Files:**

- Create: `apps/admin/src/components/suppliers/suppliers-table.tsx`
- Create: `apps/admin/src/components/suppliers/supplier-dialog.tsx`
- Create: `apps/admin/src/app/(app)/products/suppliers/page.tsx`

- [ ] **Step 1: Create the table component**

```typescript
// apps/admin/src/components/suppliers/suppliers-table.tsx
"use client";

import type { Supplier } from "@repo/tenant-orm/types";
import { PencilIcon, TrashIcon } from "@repo/ui/icons";

interface SuppliersTableProps {
  suppliers: Supplier[];
  loading: boolean;
  onEdit: (supplier: Supplier) => void;
  onDelete: (id: string) => void;
}

export function SuppliersTable({ suppliers, loading, onEdit, onDelete }: SuppliersTableProps) {
  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (suppliers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-medium">No suppliers yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add your first supplier to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Delivery</th>
            <th className="px-4 py-3 text-center font-medium text-muted-foreground">Products</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {suppliers.map((s) => (
            <tr key={s.id} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3 font-medium">{s.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.contact_email || "-"}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {s.delivery_method === "manual_email" ? "Manual Email" : s.delivery_method}
                </span>
              </td>
              <td className="px-4 py-3 text-center text-muted-foreground">{(s as Supplier & { product_count?: number }).product_count ?? 0}</td>
              <td className="px-4 py-3 text-right">
                <button onClick={() => onEdit(s)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent"><PencilIcon className="h-3.5 w-3.5" /> Edit</button>
                <button onClick={() => onDelete(s.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 ml-1"><TrashIcon className="h-3.5 w-3.5" /> Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the supplier dialog**

```typescript
// apps/admin/src/components/suppliers/supplier-dialog.tsx
"use client";

import type { Supplier } from "@repo/tenant-orm/types";
import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}

export function SupplierDialog({ open, onOpenChange, supplier, onSave, saving }: SupplierDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("manual_email");

  useEffect(() => {
    if (supplier) {
      setName(supplier.name);
      setEmail(supplier.contact_email ?? "");
      setPhone(supplier.contact_phone ?? "");
      setDeliveryMethod(supplier.delivery_method);
    } else {
      setName("");
      setEmail("");
      setPhone("");
      setDeliveryMethod("manual_email");
    }
  }, [supplier, open]);

  const handleSave = () => {
    onSave({ name, contact_email: email || null, contact_phone: phone || null, delivery_method: deliveryMethod });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{supplier ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" />
          </div>
          <div>
            <Label>Contact Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="orders@supplier.com" type="email" />
          </div>
          <div>
            <Label>Contact Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0123" />
          </div>
          <div>
            <Label>Delivery Method</Label>
            <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_email">Manual Email</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name || saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create the suppliers page**

```typescript
// apps/admin/src/app/(app)/products/suppliers/page.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { PlusIcon } from "@repo/ui/icons";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { useDeleteSupplier, useSuppliers, useCreateSupplier, useUpdateSupplier } from "@/features/suppliers/hooks/use-suppliers";

export default function SuppliersPage() {
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const { data, isLoading, isError, error, refetch } = useSuppliers(undefined, currentTenantId);
  const createMutation = useCreateSupplier(currentTenantId);
  const updateMutation = useUpdateSupplier(currentTenantId);
  const deleteMutation = useDeleteSupplier(currentTenantId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Record<string, unknown> | null>(null);

  const suppliers = data?.data ?? [];

  const handleEdit = (supplier: Record<string, unknown>) => {
    setEditingSupplier(supplier);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier? This cannot be undone if products are linked.")) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Supplier deleted");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete supplier");
    }
  };

  const handleSave = async (formData: Record<string, unknown>) => {
    try {
      if (editingSupplier) {
        await updateMutation.mutateAsync({ id: (editingSupplier as Record<string, string>).id, data: formData });
        toast.success("Supplier updated");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("Supplier created");
      }
      setDialogOpen(false);
      setEditingSupplier(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save supplier");
    }
  };

  if (isError) return <ErrorBanner message={"Failed to load suppliers: " + String(error)} onRetry={refetch} />;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-muted-foreground">Manage your vendor registry</p>
        </div>
        <Button onClick={() => { setEditingSupplier(null); setDialogOpen(true); }}>
          <PlusIcon className="mr-1 h-4 w-4" /> Add Supplier
        </Button>
      </div>

      <SuppliersTable
        suppliers={suppliers as Record<string, unknown>[]}
        loading={isLoading || tenantLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <SupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        supplier={editingSupplier as Record<string, unknown> | null}
        onSave={handleSave}
        saving={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
```

Note: The type casting to `Record<string, unknown>` is needed because the `Supplier` type from the ORM package may differ from what the API actually returns (with `product_count`). This matches the existing pattern in the codebase.

- [ ] **Step 4: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/(app)/products/suppliers/page.tsx apps/admin/src/components/suppliers/
git commit -m "feat(admin): add suppliers page with CRUD"
```

---

### Task 6: Purchase Orders List Page + Components

**Files:**

- Create: `apps/admin/src/components/purchase-orders/purchase-orders-table.tsx`
- Create: `apps/admin/src/components/purchase-orders/po-approve-modal.tsx`
- Create: `apps/admin/src/app/(app)/products/purchase-orders/page.tsx`

- [ ] **Step 1: Create the PO table component**

```typescript
// apps/admin/src/components/purchase-orders/purchase-orders-table.tsx
"use client";

import { useState } from "react";
import type { PurchaseOrder } from "@repo/tenant-orm/types";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_review: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  closed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

interface PurchaseOrdersTableProps {
  orders: PurchaseOrder[];
  loading: boolean;
  selected: Set<string>;
  onSelect: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onRowClick: (id: string) => void;
}

function formatPence(n: number): string {
  return "LB" + (n / 100).toFixed(2);
}

export function PurchaseOrdersTable({ orders, loading, selected, onSelect, onSelectAll, onRowClick }: PurchaseOrdersTableProps) {
  const allSelected = orders.length > 0 && selected.size === orders.length;

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h3 className="text-lg font-medium">No purchase orders</h3>
        <p className="mt-1 text-sm text-muted-foreground">POs will appear here once orders are placed and paid.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 w-10">
              <Checkbox checked={allSelected} onCheckedChange={(checked) => onSelectAll(!!checked)} />
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">PO Number</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Items</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((po) => (
            <tr key={po.id} className="transition-colors hover:bg-accent/50 cursor-pointer" onClick={() => onRowClick(po.id)}>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected.has(po.id)} onCheckedChange={(checked) => onSelect(po.id, !!checked)} />
              </td>
              <td className="px-4 py-3 font-mono text-sm font-medium">{po.po_number}</td>
              <td className="px-4 py-3">
                <Badge className={statusColors[po.status] ?? ""}>{po.status.replace(/_/g, " ")}</Badge>
              </td>
              <td className="px-4 py-3 text-right font-mono">{formatPence(po.total)}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{po.items?.length ?? 0}</td>
              <td className="px-4 py-3 text-right text-muted-foreground">{new Date(po.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the approve modal (smart send)**

```typescript
// apps/admin/src/components/purchase-orders/po-approve-modal.tsx
"use client";

import type { PurchaseOrder } from "@repo/tenant-orm/types";
import { Button } from "@repo/ui/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@repo/ui/components/ui/dialog";

interface POApproveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  po: PurchaseOrder | null;
  supplierEmail: string;
  onApprove: () => void;
  approving: boolean;
}

export function POApproveModal({ open, onOpenChange, po, supplierEmail, onApprove, approving }: POApproveModalProps) {
  if (!po) return null;

  const emailTemplate = `Subject: Purchase Order ${po.po_number}

Dear Supplier,

Please find attached Purchase Order ${po.po_number}.

Items:
${(po.items ?? []).map((i) => `  - ${i.product_name} x${i.quantity} @ LB${(i.unit_cost / 100).toFixed(2)}`).join("\n")}

Total: LB${(po.total / 100).toFixed(2)}

Please confirm receipt of this order.

Thanks,
Admin`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve & Send PO</DialogTitle>
          <DialogDescription>
            This PO will be marked as <strong>Sent</strong>.
            {supplierEmail ? (
              <> Please copy the email template below to send to <strong>{supplierEmail}</strong>.</>
            ) : (
              <> No email on file for this supplier.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Email Template</label>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted p-3 text-xs font-mono">{emailTemplate}</pre>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onApprove} disabled={approving}>
            {approving ? "Approving..." : "Mark as Sent"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create the POs list page**

```typescript
// apps/admin/src/app/(app)/products/purchase-orders/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@repo/ui/components/ui/tabs";
import { CheckCircleIcon } from "@repo/ui/icons";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { PurchaseOrdersTable } from "@/components/purchase-orders/purchase-orders-table";
import { POApproveModal } from "@/components/purchase-orders/po-approve-modal";
import { usePOs, useApprovePO, useBatchApprovePOs } from "@/features/purchase-orders/hooks/use-purchase-orders";

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const { data, isLoading, isError, error, refetch } = usePOs({ status: statusFilter }, currentTenantId);
  const approveMutation = useApprovePO(currentTenantId);
  const batchApproveMutation = useBatchApprovePOs(currentTenantId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingPO, setApprovingPO] = useState<string | null>(null);

  const orders = data?.data ?? [];

  const handleApprove = async (id: string) => {
    setApprovingPO(id);
    try {
      await approveMutation.mutateAsync(id);
      toast.success("PO approved and sent");
      setApproveModalOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to approve PO");
    } finally {
      setApprovingPO(null);
    }
  };

  const handleBatchApprove = async () => {
    if (selected.size === 0) return;
    try {
      const result = await batchApproveMutation.mutateAsync(Array.from(selected));
      toast.success(result.approved + " POs approved");
      setSelected(new Set());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Batch approval failed");
    }
  };

  if (isError) return <ErrorBanner message={"Failed to load POs: " + String(error)} onRetry={refetch} />;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Purchase Orders</h1>
        <p className="text-muted-foreground">Review and manage supplier orders</p>
      </div>

      <Tabs defaultValue="pending_review" onValueChange={setStatusFilter}>
        <div className="mb-4 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending_review">Pending Review</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="in_transit">In Transit</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          {selected.size > 0 && (
            <Button onClick={handleBatchApprove} disabled={batchApproveMutation.isPending}>
              <CheckCircleIcon className="mr-1 h-4 w-4" />
              Approve & Send ({selected.size})
            </Button>
          )}
        </div>

        <TabsContent value={statusFilter}>
          <PurchaseOrdersTable
            orders={orders}
            loading={isLoading || tenantLoading}
            selected={selected}
            onSelect={(id, checked) => {
              const next = new Set(selected);
              checked ? next.add(id) : next.delete(id);
              setSelected(next);
            }}
            onSelectAll={(checked) => {
              if (checked) setSelected(new Set(orders.map((o) => o.id)));
              else setSelected(new Set());
            }}
            onRowClick={(id) => router.push("/products/purchase-orders/" + id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 4: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/(app)/products/purchase-orders/page.tsx apps/admin/src/components/purchase-orders/purchase-orders-table.tsx apps/admin/src/components/purchase-orders/po-approve-modal.tsx
git commit -m "feat(admin): add purchase orders list page with batch approve"
```

---

### Task 7: Purchase Order Detail Page + Components

**Files:**

- Create: `apps/admin/src/components/purchase-orders/po-detail.tsx`
- Create: `apps/admin/src/components/purchase-orders/po-items-table.tsx`
- Create: `apps/admin/src/components/purchase-orders/po-tracking-card.tsx`
- Create: `apps/admin/src/components/purchase-orders/po-timeline.tsx`
- Create: `apps/admin/src/app/(app)/products/purchase-orders/[id]/page.tsx`

- [ ] **Step 1: Create items table component**

```typescript
// apps/admin/src/components/purchase-orders/po-items-table.tsx
"use client";

import type { PurchaseOrderItem } from "@repo/tenant-orm/types";

function formatPence(n: number): string {
  return "LB" + (n / 100).toFixed(2);
}

interface POItemsTableProps {
  items: PurchaseOrderItem[];
}

export function POItemsTable({ items }: POItemsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier SKU</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Unit Cost (Wholesale)</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Subtotal</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3">
                <div className="font-medium">{item.product_name}</div>
                <div className="text-xs text-muted-foreground">{item.variant_label}</div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.supplier_sku || "-"}</td>
              <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
              <td className="px-4 py-3 text-right font-mono">{formatPence(item.unit_cost)}</td>
              <td className="px-4 py-3 text-right font-mono">{formatPence(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create tracking card component**

```typescript
// apps/admin/src/components/purchase-orders/po-tracking-card.tsx
"use client";

import { useState } from "react";
import type { PurchaseOrder } from "@repo/tenant-orm/types";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";

interface POTrackingCardProps {
  po: PurchaseOrder;
  onSave: (data: { tracking_number?: string; carrier?: string }) => void;
  saving: boolean;
}

export function POTrackingCard({ po, onSave, saving }: POTrackingCardProps) {
  const [tracking, setTracking] = useState(po.tracking_number ?? "");
  const [carrier, setCarrier] = useState(po.carrier ?? "");

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Tracking</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Tracking Number</Label>
          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 1Z999AA10123456784" />
        </div>
        <div>
          <Label>Carrier</Label>
          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. UPS, FedEx, DHL" />
        </div>
        <Button onClick={() => onSave({ tracking_number: tracking, carrier })} disabled={saving} size="sm">
          {saving ? "Saving..." : "Update Tracking"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create timeline component**

```typescript
// apps/admin/src/components/purchase-orders/po-timeline.tsx
"use client";

import type { PurchaseOrder } from "@repo/tenant-orm/types";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  sent: "Sent to Supplier",
  confirmed: "Confirmed by Supplier",
  in_transit: "In Transit",
  closed: "Delivered / Closed",
  cancelled: "Cancelled",
};

interface POTimelineProps {
  po: PurchaseOrder;
}

export function POTimeline({ po }: POTimelineProps) {
  const events: { label: string; date: string | null; active: boolean }[] = [
    { label: "Created", date: po.created_at, active: true },
    { label: statusLabels.pending_review, date: po.created_at, active: po.status === "pending_review" || !["draft"].includes(po.status) },
    { label: statusLabels.sent, date: po.sent_at, active: !!po.sent_at },
    { label: statusLabels.confirmed, date: po.confirmed_at, active: !!po.confirmed_at },
    { label: statusLabels.in_transit, date: po.tracking_number ? po.updated_at : null, active: ["in_transit", "closed"].includes(po.status) },
    { label: statusLabels.closed, date: po.closed_at, active: po.status === "closed" },
  ];

  if (po.status === "cancelled") {
    events.push({ label: statusLabels.cancelled, date: po.closed_at, active: true });
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.label} className="flex items-center gap-3">
              <div className={"h-2 w-2 rounded-full " + (ev.active ? "bg-primary" : "bg-muted")} />
              <div className="flex-1">
                <span className={"text-sm " + (ev.active ? "font-medium" : "text-muted-foreground")}>{ev.label}</span>
              </div>
              {ev.date && <span className="text-xs text-muted-foreground">{new Date(ev.date).toLocaleDateString()}</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create the main PO detail component**

```typescript
// apps/admin/src/components/purchase-orders/po-detail.tsx
"use client";

import type { PurchaseOrder } from "@repo/tenant-orm/types";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";

import { POItemsTable } from "./po-items-table";
import { POTrackingCard } from "./po-tracking-card";
import { POTimeline } from "./po-timeline";
import { POApproveModal } from "./po-approve-modal";
import { useApprovePO, useCancelPO, useConfirmPO, useMarkPOInTransit, useClosePO, useUpdatePOTracking } from "@/features/purchase-orders/hooks/use-purchase-orders";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  pending_review: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  confirmed: "bg-purple-100 text-purple-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  closed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function formatPence(n: number): string {
  return "LB" + (n / 100).toFixed(2);
}

interface PODetailProps {
  po: PurchaseOrder;
  onUpdated: () => void;
}

export function PODetailView({ po, onUpdated }: PODetailProps) {
  const approveMutation = useApprovePO();
  const cancelMutation = useCancelPO();
  const confirmMutation = useConfirmPO();
  const inTransitMutation = useMarkPOInTransit();
  const closeMutation = useClosePO();
  const trackingMutation = useUpdatePOTracking();

  const [approveModalOpen, setApproveModalOpen] = useState(false);

  const totalItems = po.items?.length ?? 0;
  const totalQty = po.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;

  const handleAction = async (action: string, mutation: { mutateAsync: (id: string) => Promise<unknown> }) => {
    try {
      await mutation.mutateAsync(po.id);
      toast.success("PO " + action);
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to " + action);
    }
  };

  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync(po.id);
      toast.success("PO approved and sent");
      setApproveModalOpen(false);
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to approve PO");
    }
  };

  const handleTrackingSave = async (data: { tracking_number?: string; carrier?: string }) => {
    try {
      await trackingMutation.mutateAsync({ id: po.id, data });
      toast.success("Tracking updated");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update tracking");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{po.po_number}</h1>
            <Badge className={statusColors[po.status] ?? ""}>{po.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="text-muted-foreground mt-1">Total: {formatPence(po.total)} &middot; {totalQty} units across {totalItems} item{totalItems !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {po.status === "pending_review" && (
          <Button onClick={() => setApproveModalOpen(true)}>Approve & Send</Button>
        )}
        {po.status === "sent" && (
          <Button onClick={() => handleAction("confirmed", confirmMutation)}>Mark as Confirmed</Button>
        )}
        {po.status === "confirmed" && (
          <Button onClick={() => handleAction("in transit", inTransitMutation)}>Mark as In Transit</Button>
        )}
        {po.status === "in_transit" && (
          <Button onClick={() => handleAction("delivered", closeMutation)}>Mark as Delivered</Button>
        )}
        {!["closed", "cancelled"].includes(po.status) && (
          <Button variant="outline" className="text-red-600" onClick={() => handleAction("cancelled", cancelMutation)}>Cancel PO</Button>
        )}
      </div>

      {/* Items Table */}
      <div>
        <h2 className="text-sm font-medium mb-2">Items</h2>
        <POItemsTable items={po.items ?? []} />
      </div>

      {/* Ship To (read-only) */}
      {po.ship_to_address_snapshot && Object.keys(po.ship_to_address_snapshot).length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-2">Ship To</h2>
          <pre className="text-xs text-muted-foreground">{JSON.stringify(po.ship_to_address_snapshot, null, 2)}</pre>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-2">Notes</h2>
          <p className="text-sm text-muted-foreground">{po.notes}</p>
        </div>
      )}

      {/* Tracking + Timeline side-by-side on wide screens */}
      <div className="grid gap-6 md:grid-cols-2">
        <POTrackingCard po={po} onSave={handleTrackingSave} saving={trackingMutation.isPending} />
        <POTimeline po={po} />
      </div>

      {/* Approve Modal */}
      <POApproveModal
        open={approveModalOpen}
        onOpenChange={setApproveModalOpen}
        po={po}
        supplierEmail=""
        onApprove={handleApprove}
        approving={approveMutation.isPending}
      />
    </div>
  );
}
```

- [ ] **Step 5: Create the PO detail page**

```typescript
// apps/admin/src/app/(app)/products/purchase-orders/[id]/page.tsx
"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@repo/ui/components/ui/skeleton";

import { ErrorBanner } from "@/components/ui/error-banner";
import { useTenantContext } from "@/contexts/tenant-context";
import { PODetailView } from "@/components/purchase-orders/po-detail";
import { usePO } from "@/features/purchase-orders/hooks/use-purchase-orders";

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();
  const { data: po, isLoading, isError, error, refetch } = usePO(id, currentTenantId);

  if (isError) return <ErrorBanner message={"Failed to load PO: " + String(error)} onRetry={refetch} />;

  if (isLoading || tenantLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!po) return <ErrorBanner message="Purchase order not found" />;

  return (
    <div className="p-6">
      <button onClick={() => router.back()} className="text-sm text-primary hover:underline mb-4 inline-block">&larr; Back to Purchase Orders</button>
      <PODetailView po={po} onUpdated={() => refetch()} />
    </div>
  );
}
```

- [ ] **Step 6: Verify typecheck**

```bash
cd /Users/giogunn/WebstormProjects/multi-tenant-shopify && pnpm --filter @repo/admin typecheck 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/app/(app)/products/purchase-orders/[id]/page.tsx apps/admin/src/components/purchase-orders/po-detail.tsx apps/admin/src/components/purchase-orders/po-items-table.tsx apps/admin/src/components/purchase-orders/po-tracking-card.tsx apps/admin/src/components/purchase-orders/po-timeline.tsx
git commit -m "feat(admin): add purchase order detail page"
```

---

### Task 8: Dashboard Pending PO Card

**Files:**

- Modify: `apps/admin/src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add pending PO section to the dashboard**

After the Fulfillment Pipeline card and before Low Stock Alerts, add:

```typescript
      {/* Pending Purchase Orders */}
      {data.pending_pos && data.pending_pos.count > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Pending Purchase Orders</CardTitle>
              <CardDescription>Awaiting review</CardDescription>
            </div>
            <a href="/products/purchase-orders" className="text-sm text-primary hover:underline">View All</a>
          </CardHeader>
          <div className="px-6 pb-4 flex items-center gap-6">
            <div className="text-2xl font-bold tabular-nums">{data.pending_pos.count}</div>
            <div className="text-sm text-muted-foreground">Total: {formatPence(data.pending_pos.total)}</div>
          </div>
        </Card>
      )}
```

Add the required imports if not present:

```typescript
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
```

Note: Card, CardDescription, CardHeader, CardTitle are already imported in the dashboard page.

- [ ] **Step 2: Commit**

```bash
git add apps/admin/src/app/(app)/dashboard/page.tsx
git commit -m "feat(admin): add pending PO card to dashboard"
```

---

### Task 9: Sidebar Navigation Update (app-sidebar)

- [ ] **Step 1: Update the sidebar**

This was detailed in Task 4, but is independent. Re-read the spec in Task 4 and implement it.

```bash
git add packages/ui/src/components/blocks/dashboard/app-sidebar.tsx
git commit -m "feat(admin): add procurement sidebar section with POs and suppliers"
```

---

## Self-Review Checklist

- [ ] All 8 tasks produce independently testable deliverables
- [ ] Types match the backend API response shapes
- [ ] All queries have `enabled: !!tid` guard
- [ ] Cost columns are labeled "Unit Cost (Wholesale)" not "Price"
- [ ] Status badges use distinct colors
- [ ] Batch approve only appears when items are selected
- [ ] "Approve & Send" shows modal with email template for manual_email suppliers
- [ ] Navigation items linked to correct routes
