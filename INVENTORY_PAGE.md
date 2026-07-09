# Inventory Page — Implementation Plan

This is a proposed **Inventory** sub-page under Products (`/products/inventory`), wired with shadcn/ui (base-ui), React Query, and the existing multi-tenant context pattern. The sidebar already has the nav entry — only the page/files need creating.

---

## What to Build

Six files, following the exact pattern established by `products`, `customers`, `collections`:

```
apps/admin/src/app/(app)/products/inventory/
├── page.tsx                          # page shell: client component

apps/admin/src/features/inventory/
├── api/inventory-service.ts          # service layer
├── hooks/use-inventory.ts            # React Query hooks
├── components/
├── ├── inventory-table.tsx           # data table
├── ├── inventory-stats.tsx           # KPI cards
├── ├── inventory-dialog.tsx          # add/edit dialog
├── └── inventory-filters.tsx         # filter bar

apps/admin/src/lib/api/client.ts      # + api.inventory namespace

packages/tenant-orm/src/types.ts      # + InventoryItem types
```

---

## 1. Types — `packages/tenant-orm/src/types.ts`

Add to existing file (snake_case matching backend response):

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
  status: InventoryStatus;
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

---

## 2. API Client — `apps/admin/src/lib/api/client.ts`

Add the `inventory` namespace:

```typescript
import type { InventoryItem, InventoryListResponse } from "@repo/tenant-orm/types";

// Inside the api object, after dashboard:

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
    return request<{
      total_skus: number;
      total_value: number;
      low_stock_count: number;
      out_of_stock_count: number;
    }>("/inventory/stats", options ?? {});
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

---

## 3. Service — `apps/admin/src/features/inventory/api/inventory-service.ts`

```typescript
import type {
  InventoryItem,
  InventoryListResponse,
} from "@repo/tenant-orm/types";

import { api } from "@/lib/api/client";

interface InventoryParams {
  search?: string;
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
  if (params.search) q.q = params.search;
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
  if (!tid)
    return {
      total_skus: 0,
      total_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };
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

---

## 4. Hooks — `apps/admin/src/features/inventory/hooks/use-inventory.ts`

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

export function useInventoryItems(
  params?: {
    search?: string;
    category?: string;
    status?: string;
    page?: string;
    page_size?: string;
    sort_by?: string;
    sort_order?: string;
  },
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

---

## 5. Page — `apps/admin/src/app/(app)/products/inventory/page.tsx`

```tsx
"use client";

import type { InventoryItem } from "@repo/tenant-orm/types";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/ui/button";
import { useRbac } from "@/contexts/rbac-context";
import { useTenantContext } from "@/contexts/tenant-context";
import {
  useInventoryItems,
  useInventoryStats,
  useDeleteInventoryItem,
} from "@/features/inventory/hooks/use-inventory";

import { InventoryFilters } from "@/features/inventory/components/inventory-filters";
import { InventoryStatsCards } from "@/features/inventory/components/inventory-stats";
import { InventoryTable } from "@/features/inventory/components/inventory-table";
import { InventoryDialog } from "@/features/inventory/components/inventory-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";

export default function InventoryPage() {
  const { can } = useRbac();
  const { currentTenantId, isLoading: tenantLoading } = useTenantContext();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const itemsQuery = useInventoryItems(
    {
      search,
      category,
      status,
      page: String(page),
      page_size: String(pageSize),
    },
    currentTenantId,
  );

  const statsQuery = useInventoryStats(currentTenantId);
  const deleteMutation = useDeleteInventoryItem(currentTenantId);

  const items = itemsQuery.data?.data ?? [];
  const total = itemsQuery.data?.total ?? 0;

  const handleDelete = (id: string) => {
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

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="p-6 space-y-6">
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
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        onCategoryChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
        onStatusChange={(v) => {
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        tenantId={currentTenantId}
      />
    </div>
  );
}
```

---

## 6. Components

### `inventory-stats.tsx`

```tsx
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { Skeleton } from "@repo/ui/components/ui/skeleton";

interface Stats {
  total_skus: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export function InventoryStatsCards({
  stats,
  loading,
}: {
  stats: Stats | undefined;
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
      value: `£${stats.total_value.toLocaleString()}`,
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
            <CardDescription>{c.label}</CardDescription>
            <CardTitle className="font-mono text-2xl">{c.value}</CardTitle>
            {c.sub && <p className="text-xs text-muted-foreground">{c.sub}</p>}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
```

### `inventory-filters.tsx`

```tsx
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { Search } from "@repo/ui/icons";

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
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
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

### `inventory-table.tsx`

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
  Edit2,
  Trash2,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@repo/ui/icons";

const statusVariant: Record<
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
                <TableCell className="text-right font-mono">
                  {item.total_stock}
                </TableCell>
                <TableCell className="text-right font-mono">
                  £{item.total_value.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[item.status] ?? "outline"}>
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
                      <Edit2 /> Edit
                    </Button>
                    {canDelete && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeletingId(item.id)}
                        >
                          <Trash2 /> Delete
                        </Button>
                        <AlertDialog
                          open={deletingId === item.id}
                          onOpenChange={(o) => {
                            if (!o) setDeletingId(null);
                          }}
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete item?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete {item.name} and its
                                variants.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(item.id)}
                                className="bg-destructive"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {total > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {(page - 1) * pageSize + 1}\u2013{Math.min(page * pageSize, total)}{" "}
            of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronLeftIcon /> Previous
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
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### `inventory-dialog.tsx`

```tsx
import type { InventoryItem } from "@repo/tenant-orm/types";
import { useState } from "react";
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
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [supplier, setSupplier] = useState(item?.supplier ?? "");
  const [loading, setLoading] = useState(false);

  const createMutation = useCreateInventoryItem(tenantId);
  const updateMutation = useUpdateInventoryItem(tenantId);

  const handleSubmit = async () => {
    setLoading(true);
    const data = {
      name,
      sku,
      category: category || undefined,
      supplier: supplier || undefined,
    };

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
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add Item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !name || !sku}>
            {loading ? "Saving..." : item ? "Save changes" : "Create item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Deviations from Original `INVENTORY_PAGE.md`

| Original                                          | Revised                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| Standalone `types/inventory.ts`                   | Types in `@repo/tenant-orm/types.ts` (shared package)                      |
| Raw `fetch` calls in service                      | Uses `api.inventory.*` from `client.ts` with automatic auth/tenant headers |
| Custom `useInventory` hook (useState + useEffect) | React Query `useQuery`/`useMutation` (cache, refetch, loading/error state) |
| Raw `<table>`, `<input>`, `<select>`, `<button>`  | shadcn `Table`, `Input`, `Select`, `Button`                                |
| Custom `ToastContainer`                           | `sonner` (`toast.success`, `toast.error`)                                  |
| Custom modal overlay                              | shadcn `Dialog`                                                            |
| Custom `ConfirmDialog`                            | shadcn `AlertDialog`                                                       |
| Custom `StatCard`                                 | shadcn `Card` + `Skeleton`                                                 |
| Manual `statusColors` object                      | `Badge` variant prop                                                       |
| `localStorage.getItem('token')`                   | `@clerk/nextjs` auth via `client.ts`                                       |
| Hardcoded `tenant_abc123`                         | `tenantId` from `useTenantContext()`, falling back to `sessionStorage`     |
| Backend code (FastAPI, models, routes)            | Removed entirely (out of scope)                                            |
| `<Space-y-*>`                                     | `gap-*` (shadcn rule)                                                      |
| `w-10 h-10`                                       | `size-*` (shadcn rule)                                                     |
| BEM-style classnames                              | shadcn semantic tokens (`bg-background`, `text-muted-foreground`)          |
