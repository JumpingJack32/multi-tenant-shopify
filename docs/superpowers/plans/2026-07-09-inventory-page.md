# Inventory Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Inventory management sub-page at `/products/inventory` with stats cards, filterable data table, and CRUD dialog.

**Architecture:** Single-page feature following the Products/Customers/Collections pattern exactly: types in shared ORM package → API client namespace → feature-scoped service → React Query hooks → shadcn components → page shell.

**Tech Stack:** Next.js App Router, shadcn/ui (base-ui/sera), TanStack Query, `sonner` toast, Lucide icons, `@repo/tenant-orm`, `@repo/ui`.

## Global Constraints

- All new files follow existing pattern: feature directories under `apps/admin/src/features/inventory/` with `api/`, `hooks/`, `components/` subdirectories
- Types added to `@repo/tenant-orm/src/types.ts` (snake_case fields matching backend response)
- API namespace added to `apps/admin/src/lib/api/client.ts`
- Hook pattern: `tenantId` optional last param, `getStorageTenantId()` fallback, `enabled: !!tid`, `tid` in `queryKey`
- Page pattern: `"use client"`, `useTenantContext()`, pass `currentTenantId` to all hooks, `tenantLoading || isPending` for loading
- shadcn rules: `gap-*` not `space-*` (use `flex flex-col gap-6` instead of `space-y-6`), `size-*` for equal dimensions, semantic colors (`bg-background`, `text-muted-foreground`), `data-icon` on icons in buttons, `cn()` for conditionals
- All icons from `@repo/ui/icons` (re-exports `lucide-react`)
- Toast via `sonner`: `toast.success()`, `toast.error()`
- Delete confirmation via `AlertDialog`
- Add/edit via `Dialog`
- Monetary values displayed as `£{value.toLocaleString()}` (value stored as GBP, not pence)

---

### Task 1: Inventory Types

**Files:**

- Modify: `packages/tenant-orm/src/types.ts` (append at end)

**Interfaces:**

- Consumes: Existing type conventions (snake_case, `interface` over `type`)
- Produces: `InventoryItem`, `InventoryVariant`, `InventoryStats`, `InventoryListResponse`

- [ ] **Step 1: Read existing types file**

```bash
cat packages/tenant-orm/src/types.ts | tail -20
```

- [ ] **Step 2: Append inventory types**

Add to end of `packages/tenant-orm/src/types.ts`:

```typescript
export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "discontinued";

export interface InventoryVariant {
  id: string;
  item_id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  cost: number;
  stock: number;
  reorder_point: number;
  warehouse: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: StockStatus;
  supplier: string | null;
  total_stock: number;
  total_value: number;
  variants: InventoryVariant[];
  created_at: string;
  updated_at: string;
}

export interface InventoryStats {
  total_skus: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_variants: number;
}

export interface InventoryListResponse {
  data: InventoryItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck --filter @repo/tenant-orm 2>&1
```

Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add packages/tenant-orm/src/types.ts
git commit -m "feat(tenant-orm): add inventory types"
```

---

### Task 2: API Client — `api.inventory` namespace

**Files:**

- Modify: `apps/admin/src/lib/api/client.ts`

**Interfaces:**

- Consumes: `request<T>()`, `buildQuery()`, `InventoryListResponse`, `InventoryItem`, `InventoryStats` types
- Produces: `api.inventory.list()`, `.get()`, `.stats()`, `.create()`, `.update()`, `.delete()`

- [ ] **Step 1: Read current client.ts**

```bash
cat apps/admin/src/lib/api/client.ts
```

Note where `dashboard` namespace ends (last namespace before closing `}`).

- [ ] **Step 2: Add `InventoryItem`, `InventoryListResponse` imports**

Find the `import type` block at the top and add:

```typescript
import type {
  Collection,
  CustomerDetail,
  DashboardSummary,
  InventoryItem,
  InventoryListResponse,
  Product,
  ProductCreate,
  ProductUpdate,
} from "@repo/tenant-orm/types";
```

- [ ] **Step 3: Add `inventory` namespace to the `api` object**

Insert before the closing `}` of the `api` object (after the `dashboard` namespace):

```typescript
inventory: {
  list(
    params?: Record<string, string>,
    options?: { tenantId?: string | null },
  ) {
    return request<InventoryListResponse>(
      `/inventory${buildQuery(params)}`,
      options ?? {},
    );
  },
  get(id: string, options?: { tenantId?: string | null }) {
    return request<InventoryItem>(`/inventory/${id}`, options ?? {});
  },
  stats(options?: { tenantId?: string | null }) {
    return request<InventoryStats>("/inventory/stats", options ?? {});
  },
  create(data: Record<string, unknown>, options?: { tenantId?: string | null }) {
    return request<InventoryItem>("/inventory", {
      method: "POST",
      body: JSON.stringify(data),
      ...options,
    });
  },
  update(id: string, data: Record<string, unknown>, options?: { tenantId?: string | null }) {
    return request<InventoryItem>(`/inventory/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      ...options,
    });
  },
  delete(id: string, options?: { tenantId?: string | null }) {
    return request<void>(`/inventory/${id}`, {
      method: "DELETE",
      ...options,
    });
  },
},
```

- [ ] **Step 4: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/lib/api/client.ts
git commit -m "feat(admin): add api.inventory namespace"
```

---

### Task 3: Inventory Service

**Files:**

- Create: `apps/admin/src/features/inventory/api/inventory-service.ts`

**Interfaces:**

- Consumes: `api.inventory.*`, `InventoryItem` type
- Produces: `fetchInventoryItems(params, tenantId?)`, `fetchInventoryStats(tenantId?)`, `createInventoryItem(data, tenantId?)`, `updateInventoryItem(id, data, tenantId?)`, `deleteInventoryItem(id, tenantId?)`

- [ ] **Step 1: Create the feature directory**

```bash
mkdir -p apps/admin/src/features/inventory/api
mkdir -p apps/admin/src/features/inventory/hooks
mkdir -p apps/admin/src/features/inventory/components
```

- [ ] **Step 2: Create service file**

Create `apps/admin/src/features/inventory/api/inventory-service.ts`:

```typescript
import type { InventoryItem } from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

interface InventoryParams {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
  page_size?: string;
  sort_by?: string;
  sort_order?: string;
}

export async function fetchInventoryItems(
  params: InventoryParams,
  tenantId?: string | null,
): Promise<{ data: InventoryItem[]; total: number }> {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) return { data: [], total: 0 };

  const q: Record<string, string> = {};
  if (params.q) q.q = params.q;
  if (params.category) q.category = params.category;
  if (params.status) q.status = params.status;
  if (params.page) q.page = params.page;
  if (params.page_size) q.page_size = params.page_size;
  if (params.sort_by) q.sort_by = params.sort_by;
  if (params.sort_order) q.sort_order = params.sort_order;

  const result = await api.inventory.list(q, { tenantId: tid });

  return {
    data: result.data,
    total: result.pagination.total,
  };
}

export async function fetchInventoryStats(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) {
    return {
      total_skus: 0,
      total_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };
  }
  return api.inventory.stats({ tenantId: tid });
}

export async function createInventoryItem(
  data: Record<string, unknown>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.create(data, { tenantId: tid });
}

export async function updateInventoryItem(
  id: string,
  data: Record<string, unknown>,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.update(id, data, { tenantId: tid });
}

export async function deleteInventoryItem(
  id: string,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  if (!tid) throw new Error("No tenant selected");
  return api.inventory.delete(id, { tenantId: tid });
}

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/features/inventory/
git commit -m "feat(admin): add inventory service layer"
```

---

### Task 4: Inventory Hooks

**Files:**

- Create: `apps/admin/src/features/inventory/hooks/use-inventory.ts`

**Interfaces:**

- Consumes: `fetchInventoryItems`, `fetchInventoryStats`, `createInventoryItem`, `updateInventoryItem`, `deleteInventoryItem`
- Produces: `useInventoryItems(params?, tenantId?)`, `useInventoryStats(tenantId?)`, `useCreateInventoryItem(tenantId?)`, `useUpdateInventoryItem(tenantId?)`, `useDeleteInventoryItem(tenantId?)`

- [ ] **Step 1: Create hooks file**

Create `apps/admin/src/features/inventory/hooks/use-inventory.ts`:

```typescript
import type { InventoryItem } from "@repo/tenant-orm/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  fetchInventoryItems,
  fetchInventoryStats,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from "../api/inventory-service";

interface InventoryQueryParams {
  q?: string;
  category?: string;
  status?: string;
  page?: string;
  page_size?: string;
  sort_by?: string;
  sort_order?: string;
}

export function useInventoryItems(
  params?: InventoryQueryParams,
  tenantId?: string | null,
) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery({
    queryKey: ["inventory", "items", params, tid],
    queryFn: () => fetchInventoryItems(params ?? {}, tid),
    enabled: !!tid,
  });
}

export function useInventoryStats(tenantId?: string | null) {
  const tid = tenantId ?? getStorageTenantId();
  return useQuery({
    queryKey: ["inventory", "stats", tid],
    queryFn: () => fetchInventoryStats(tid),
    enabled: !!tid,
  });
}

export function useCreateInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      createInventoryItem(data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useUpdateInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateInventoryItem(id, data, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useDeleteInventoryItem(tenantId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInventoryItem(id, tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

function getStorageTenantId(): string | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const store = globalThis as { sessionStorage?: Storage };
    return store.sessionStorage?.getItem("admin_selected_tenant") ?? null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/inventory/hooks/use-inventory.ts
git commit -m "feat(admin): add inventory React Query hooks"
```

---

### Task 5: Inventory Stats Cards Component

**Files:**

- Create: `apps/admin/src/features/inventory/components/inventory-stats.tsx`

**Interfaces:**

- Consumes: `InventoryStats` from `@repo/tenant-orm/types`
- Produces: `<InventoryStatsCards stats loading />` — renders grid of 4 shadcn `Card` components

- [ ] **Step 1: Create stats component**

Create `apps/admin/src/features/inventory/components/inventory-stats.tsx`:

```tsx
import { Card, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface InventoryStatsData {
  total_skus: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export function InventoryStatsCards({
  stats,
  loading,
}: {
  stats: InventoryStatsData | undefined;
  loading: boolean;
}) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-28 mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Total SKUs", value: stats.total_skus.toLocaleString() },
    {
      label: "Inventory Value",
      value: `\u00A3${stats.total_value.toLocaleString()}`,
    },
    {
      label: "Low Stock",
      value: stats.low_stock_count,
      sub: "Needs attention",
    },
    {
      label: "Out of Stock",
      value: stats.out_of_stock_count,
      sub: "Reorder now",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/inventory/components/inventory-stats.tsx
git commit -m "feat(admin): add inventory stats cards"
```

---

### Task 6: Inventory Filters Component

**Files:**

- Create: `apps/admin/src/features/inventory/components/inventory-filters.tsx`

**Interfaces:**

- Consumes: shadcn `Input`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`; `Search` from `@repo/ui/icons`
- Produces: `<InventoryFilters search category status onSearch onCategory onStatus />`

- [ ] **Step 1: Create filters component**

Create `apps/admin/src/features/inventory/components/inventory-filters.tsx`:

```tsx
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { SearchIcon } from "@repo/ui/icons";

interface InventoryFiltersProps {
  search: string;
  category: string;
  status: string;
  onSearch: (v: string) => void;
  onCategory: (v: string) => void;
  onStatus: (v: string) => void;
}

export function InventoryFilters({
  search,
  category,
  status,
  onSearch,
  onCategory,
  onStatus,
}: InventoryFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={category} onValueChange={onCategory}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All categories</SelectItem>
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={onStatus}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="in_stock">In Stock</SelectItem>
          <SelectItem value="low_stock">Low Stock</SelectItem>
          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          <SelectItem value="discontinued">Discontinued</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/inventory/components/inventory-filters.tsx
git commit -m "feat(admin): add inventory filters component"
```

---

### Task 7: Inventory Table Component

**Files:**

- Create: `apps/admin/src/features/inventory/components/inventory-table.tsx`

**Interfaces:**

- Consumes: `InventoryItem` type, shadcn `Table` family, `Badge`, `Button`, `Skeleton`, `AlertDialog` family, `ChevronLeftIcon`, `ChevronRightIcon`, `Edit2`, `Trash2` icons
- Produces: `<InventoryTable items loading total page pageSize totalPages onPageChange onEdit onDelete deletingId setDeletingId canDelete />`

- [ ] **Step 1: Create table component**

Create `apps/admin/src/features/inventory/components/inventory-table.tsx`:

```tsx
import type { InventoryItem } from "@repo/tenant-orm/types";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Edit2,
  Trash2,
} from "@repo/ui/icons";

const statusVariantMap: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  in_stock: "default",
  low_stock: "secondary",
  out_of_stock: "destructive",
  discontinued: "outline",
};

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  setDeletingId: (id: string | null) => void;
  canDelete: boolean;
}

export function InventoryTable({
  items,
  loading,
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onEdit,
  onDelete,
  deletingId,
  setDeletingId,
  canDelete,
}: InventoryTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableCell key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
              ))}
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={7}
                className="py-8 text-center text-muted-foreground"
              >
                No inventory items found.
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.sku}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {item.category || "\u2014"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.total_stock}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  \u00A3{item.total_value.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariantMap[item.status] ?? "outline"}>
                    {item.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                    >
                      <Edit2 data-icon="inline-start" />
                      Edit
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingId(item.id)}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {!loading && total > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * pageSize + 1}\u2013
            {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}

      {deletingId && (
        <AlertDialog
          open={!!deletingId}
          onOpenChange={(open) => {
            if (!open) setDeletingId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this item and its variants. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/inventory/components/inventory-table.tsx
git commit -m "feat(admin): add inventory table component"
```

---

### Task 8: Inventory Dialog Component

**Files:**

- Create: `apps/admin/src/features/inventory/components/inventory-dialog.tsx`

**Interfaces:**

- Consumes: `InventoryItem` type, `useCreateInventoryItem`, `useUpdateInventoryItem`, shadcn `Dialog` family, `Input`, `Label`, `Button`, `sonner`
- Produces: `<InventoryDialog open onOpenChange item tenantId />`

- [ ] **Step 1: Create dialog component**

Create `apps/admin/src/features/inventory/components/inventory-dialog.tsx`:

```tsx
import type { InventoryItem } from "@repo/tenant-orm/types";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from "@/features/inventory/hooks/use-inventory";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  tenantId?: string | null;
}

export function InventoryDialog({
  open,
  onOpenChange,
  item,
  tenantId,
}: InventoryDialogProps) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateInventoryItem(tenantId);
  const updateMutation = useUpdateInventoryItem(tenantId);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setSku(item?.sku ?? "");
      setCategory(item?.category ?? "");
      setSupplier(item?.supplier ?? "");
    }
  }, [open, item]);

  const handleSubmit = async () => {
    setSaving(true);
    const data: Record<string, unknown> = { name, sku };
    if (category) data.category = category;
    if (supplier) data.supplier = supplier;

    try {
      if (item) {
        await updateMutation.mutateAsync({ id: item.id, data });
        toast.success("Inventory item updated");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Inventory item created");
      }
      onOpenChange(false);
    } catch {
      toast.error(item ? "Failed to update item" : "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Inventory Item" : "Add Inventory Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="inventory-name">Product Name *</Label>
            <Input
              id="inventory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-sku">SKU *</Label>
            <Input
              id="inventory-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-category">Category</Label>
            <Input
              id="inventory-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="inventory-supplier">Supplier</Label>
            <Input
              id="inventory-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !name || !sku}>
            {saving ? "Saving..." : item ? "Save changes" : "Create item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck --filter @repo/admin 2>&1
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/features/inventory/components/inventory-dialog.tsx
git commit -m "feat(admin): add inventory add/edit dialog"
```

---

### Task 9: Inventory Page

**Files:**

- Create: `apps/admin/src/app/(app)/products/inventory/page.tsx`

**Interfaces:**

- Consumes: `useTenantContext`, `useRbac`, `useInventoryItems`, `useInventoryStats`, `useDeleteInventoryItem`, all inventory components, `ErrorBanner`, `sonner`
- Produces: Page at `/products/inventory`

- [ ] **Step 1: Create page directory**

```bash
mkdir -p apps/admin/src/app/\(app\)/products/inventory
```

- [ ] **Step 2: Create page file**

Create `apps/admin/src/app/(app)/products/inventory/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useInventoryItems,
  useInventoryStats,
  useDeleteInventoryItem,
} from "@/features/inventory/hooks/use-inventory";
import { InventoryStatsCards } from "@/features/inventory/components/inventory-stats";
import { InventoryFilters } from "@/features/inventory/components/inventory-filters";
import { InventoryTable } from "@/features/inventory/components/inventory-table";
import { InventoryDialog } from "@/features/inventory/components/inventory-dialog";

export default function InventoryPage() {
  const { can } = useRbac();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const itemsQuery = useInventoryItems(
    {
      q: search || undefined,
      category: category || undefined,
      status: status || undefined,
      page: String(page),
      page_size: String(pageSize),
    },
    currentTenantId,
  );

  const statsQuery = useInventoryStats(currentTenantId);
  const deleteMutation = useDeleteInventoryItem(currentTenantId);

  const items = itemsQuery.data?.data ?? [];
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleDelete = (id) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Item deleted");
        setDeletingId(null);
      },
      onError: () => {
        toast.error("Failed to delete item");
        setDeletingId(null);
      },
    });
  };

  const handleOpenChange = (open) => {
    setDialogOpen(open);
    if (!open) setEditingItem(null);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock across all warehouses
          </p>
        </div>
        {can("update") && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setDialogOpen(true);
            }}
          >
            Add Item
          </Button>
        )}
      </div>

      <InventoryStatsCards
        stats={statsQuery.data}
        loading={statsQuery.isPending || tenantLoading}
      />

      <InventoryFilters
        search={search}
        category={category}
        status={status}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onCategory={(v) => {
          setCategory(v);
          setPage(1);
        }}
        onStatus={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />

      {itemsQuery.isError && (
        <ErrorBanner
          message={
            itemsQuery.error instanceof Error
              ? itemsQuery.error.message
              : "Failed to load inventory"
          }
          onRetry={() => itemsQuery.refetch()}
        />
      )}

      <InventoryTable
        items={items}
        loading={itemsQuery.isPending || tenantLoading}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onEdit={(item) => {
          setEditingItem(item);
          setDialogOpen(true);
        }}
        onDelete={handleDelete}
        deletingId={deletingId}
        setDeletingId={setDeletingId}
        canDelete={can("delete")}
      />

      <InventoryDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        item={editingItem}
        tenantId={currentTenantId}
      />
    </div>
  );
}
```

- [ ] **Step 3: Fix import types — add type annotation for editingItem and deletingId**

The `useState(null)` calls need explicit type annotations. Edit to match:

```tsx
import type { InventoryItem } from "@repo/tenant-orm/types";
```

And change:

```tsx
const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
const [deletingId, setDeletingId] = useState<string | null>(null);
```

And fix callback types:

```tsx
const handleDelete = (id: string) => {
```

```tsx
const handleOpenChange = (open: boolean) => {
```

```tsx
onEdit={(item: InventoryItem) => {
```

- [ ] **Step 4: Verify lint and typecheck**

```bash
pnpm lint --filter @repo/admin -- --fix 2>&1 | tail -10
pnpm typecheck --filter @repo/admin 2>&1 | tail -10
```

Expected: Both PASS (0 errors).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/app/\(app\)/products/inventory/page.tsx
git add apps/admin/src/features/inventory/
git commit -m "feat(admin): add inventory management page at /products/inventory"
```

---

### Task 10: Verify full pipeline

- [ ] **Step 1: Run typecheck across all packages**

```bash
pnpm typecheck 2>&1 | tail -20
```

Expected: All packages pass.

- [ ] **Step 2: Run admin tests**

```bash
pnpm test --filter @repo/admin 2>&1 | tail -15
```

Expected: 20 tests pass (existing tests unaffected, no new tests yet).

- [ ] **Step 3: Run lint across admin**

```bash
pnpm lint --filter @repo/admin 2>&1 | tail -10
```

Expected: PASS (0 errors).

- [ ] **Step 4: Final commit**

```bash
git add -A
git status
git commit -m "feat(admin): wire up full inventory page with stats, filters, table, CRUD"
```
