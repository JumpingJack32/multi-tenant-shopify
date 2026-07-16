# Review & Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs, complete missing components, and align schemas for the multi-tenant product CRUD UI.

**Architecture:** Incremental fixes and additions to existing codebase — fix layout/provider composition, correct RBAC bugs, complete product form, build missing table/drawer/dialog components, and align frontend/backend schemas.

**Tech Stack:** Next.js 16, @clerk/nextjs v7, @tanstack/react-query, @base-ui/react (via `@repo/ui/base-ui`), Tailwind v4, Zod + react-hook-form, Python FastAPI backend.

## Global Constraints

- `@clerk/nextjs` v7.5.7 — `setActive` from `useAuth()`, `isLoaded` from `useSignIn()`.
- `@repo/ui/base-ui` — correct import path for Base UI primitives.
- Base UI `Field` does not support JSX children — use `<div>` + `<label>`.
- RBAC permissions are `"create" | "read" | "update" | "delete"` — NOT `"edit"`.
- Frontend Product types must match backend: `slug`, `weight`, `is_active` present; no `price`.
- Status values: `"published"`, `"draft"`, `"archived"` — NOT `"active"`.
- DRY, YAGNI, TDD where applicable. Frequent commits.

---

## Task 1: Fix Layout & Provider Composition

**Files:**

- Modify: `apps/admin/src/app/layout.tsx`
- Modify: `apps/admin/src/components/layout/app-shell.tsx`

**Interfaces:**

- Consumes: Existing `TenantProvider`, `RbacProvider`, `QueryClient` from layout.
- Produces: `AppShell` wraps sidebar + main content with all providers composed inside.

### Step 1: Move providers into AppShell

- [ ] **Step 1: Update `app-shell.tsx` to compose providers**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TenantProvider } from "@/contexts/tenant-context";
import { RbacProvider } from "@/contexts/rbac-context";

const queryClient = new QueryClient();

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <RbacProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </RbacProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Update `layout.tsx` to remove providers from root and wrap routes**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "@repo/ui/globals.css";
import Header from "@/components/layout/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Multi-tenant Shopify admin control panel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Header />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Create `apps/admin/src/app/(app)/layout.tsx` for authenticated routes**

```tsx
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 4: Move `products/page.tsx` into `apps/admin/src/app/(app)/products/page.tsx`**

Run: `mkdir -p apps/admin/src/app/\(app\)/products && mv apps/admin/src/app/products/page.tsx apps/admin/src/app/\(app\)/products/`

Expected: Products page now renders inside `AppShell` with providers.

### Step 2: Verify layout renders correctly

- [ ] **Step 5: Run dev server and verify layout**

Run: `cd apps/admin && npm run dev`

Expected: Sidebar visible on left, header at top, products page renders inside shell with providers.

---

## Task 2: Fix RBAC Bug in Products Page

**Files:**

- Modify: `apps/admin/src/app/(app)/products/page.tsx`

**Interfaces:**

- Consumes: `useRbac()` from `@/contexts/rbac-context` which defines `"create" | "read" | "update" | "delete"`.
- Produces: Correct permission checks using `"update"` instead of `"edit"`.

### Step 1: Replace `can("edit")` with `can("update")`

- [ ] **Step 1: Fix the edit permission check**

Find line 111 in `products/page.tsx`:

```tsx
{can("edit") && (
```

Replace with:

```tsx
{can("update") && (
```

- [ ] **Step 2: Verify no other `can("edit")` references exist**

Run: `rg 'can\("edit"\)' apps/admin/src/`

Expected: No matches found.

---

## Task 3: Update Header with Tenant Indicator & Role Badge

**Files:**

- Modify: `apps/admin/src/components/layout/header.tsx`

**Interfaces:**

- Consumes: `useTenantContext()` for current tenant name, `useRbac()` for role.
- Produces: Header with tenant pill and role badge next to UserButton.

### Step 1: Add tenant indicator and role badge

- [ ] **Step 1: Update header.tsx**

```tsx
"use client";

import {
  useAuth,
  UserButton,
  SignInButton,
  SignOutButton,
} from "@clerk/nextjs";
import { useTenantContext } from "@/contexts/tenant-context";
import { useRbac } from "@/contexts/rbac-context";

export default function Header() {
  const { isSignedIn } = useAuth();
  const { currentTenant } = useTenantContext();
  const { role } = useRbac();

  return (
    <header className="border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold">Admin</span>
        <div className="flex items-center gap-4">
          {isSignedIn && currentTenant && (
            <>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {currentTenant.name}
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                {role}
              </span>
            </>
          )}
          {isSignedIn ? (
            <>
              <SignOutButton>
                <button className="text-sm text-red-500 hover:underline">
                  Logout
                </button>
              </SignOutButton>
              <UserButton />
            </>
          ) : (
            <SignInButton mode="modal" />
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify header renders tenant pill and role badge**

Run: `cd apps/admin && npm run dev`

Expected: Header shows tenant name pill and role badge when signed in.

---

## Task 4: Align Frontend/Backend Product Schemas

**Files:**

- Modify: `packages/tenant-orm/src/types.ts`
- Modify: `packages/tenant-orm/src/schemas/tenant.ts`

**Interfaces:**

- Consumes: Backend `product.py` schema (has `slug`, `weight`, `is_active`, no `price`).
- Produces: Frontend `Product` interface matches backend exactly.

### Step 1: Update Product type to match backend

- [ ] **Step 1: Update `types.ts` Product interface**

Replace the existing `Product` interface with:

```typescript
export interface Product {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  status: "draft" | "published" | "archived";
  weight: number | null;
  weight_unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Update `schemas/tenant.ts` Zod schemas**

Replace `ProductSchema`:

```typescript
export const ProductSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullish(),
  sku: z.string().nullish(),
  status: z.enum(["draft", "published", "archived"]),
  weight: z.number().nullish(),
  weight_unit: z.string().default("kg"),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

Replace `ProductCreateSchema`:

```typescript
export const ProductCreateSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().nullish(),
  sku: z.string().nullish(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  weight: z.number().nullish(),
  weight_unit: z.string().default("kg"),
  is_active: z.boolean().default(true),
});
```

Replace `ProductUpdateSchema`:

```typescript
export const ProductUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  sku: z.string().nullish(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  weight: z.number().nullish(),
  weight_unit: z.string().optional(),
  is_active: z.boolean().optional(),
});
```

- [ ] **Step 3: Verify no `price` field references remain in frontend**

Run: `rg 'price' apps/admin/src/ packages/tenant-orm/src/`

Expected: No `price` references in admin app or tenant-orm (backend may still reference it if needed).

---

## Task 5: Complete Product Form Component

**Files:**

- Modify: `apps/admin/src/components/products/product-form.tsx`

**Interfaces:**

- Consumes: `Product` type, `ProductCreateSchema`, `ProductUpdateSchema` from schemas.
- Produces: Complete form with name, slug, description, SKU, status, weight, weight_unit, is_active fields.

### Step 1: Rewrite product-form.tsx with all fields

- [ ] **Step 1: Create complete product form**

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ProductCreateSchema,
  ProductUpdateSchema,
  type Product,
} from "@repo/tenant-orm/schemas/tenant";
import { Button } from "@/components/ui/button";
import { Switch } from "@repo/ui/base-ui";
import { cn } from "@repo/shared-utils/cn";

interface ProductFormProps {
  initialData?: Product;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export function ProductForm({
  initialData,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const form = useForm({
    resolver: zodResolver(
      initialData ? ProductUpdateSchema : ProductCreateSchema,
    ),
    defaultValues: initialData || {
      name: "",
      slug: "",
      description: null,
      sku: null,
      status: "draft",
      weight: null,
      weight_unit: "kg",
      is_active: true,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          {...form.register("name")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium">
          Slug
        </label>
        <input
          id="slug"
          {...form.register("slug")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          {...form.register("description")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="sku" className="block text-sm font-medium">
          SKU
        </label>
        <input
          id="sku"
          {...form.register("sku")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium">
          Status
        </label>
        <select
          id="status"
          {...form.register("status")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div>
        <label htmlFor="weight" className="block text-sm font-medium">
          Weight
        </label>
        <input
          id="weight"
          type="number"
          {...form.register("weight", { valueAsNumber: true })}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="weight_unit" className="block text-sm font-medium">
          Weight Unit
        </label>
        <input
          id="weight_unit"
          {...form.register("weight_unit")}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={form.watch("is_active")}
          onCheckedChange={(checked) => form.setValue("is_active", checked)}
        />
        <label htmlFor="is_active" className="text-sm font-medium">
          Active
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{initialData ? "Update" : "Create"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verify form renders all fields and uses Base UI Switch**

Run: `cd apps/admin && npm run dev`

Expected: Form shows all fields, Switch component works, no checkbox.

---

## Task 6: Create Missing Table Components

**Files:**

- Create: `apps/admin/src/components/products/product-table.tsx`
- Create: `apps/admin/src/components/products/table-pagination.tsx`
- Create: `apps/admin/src/components/products/table-toolbar.tsx`
- Create: `apps/admin/src/components/products/product-name-cell.tsx`
- Create: `apps/admin/src/components/products/status-badge.tsx`
- Create: `apps/admin/src/components/products/relative-time-cell.tsx`

**Interfaces:**

- Consumes: `Product` type, `DataTable` component.
- Produces: Product-specific table components with proper cell rendering.

### Step 1: Create product-name-cell.tsx

```tsx
import { Product } from "@repo/tenant-orm/types";

interface ProductNameCellProps {
  product: Product;
}

export function ProductNameCell({ product }: ProductNameCellProps) {
  return (
    <div>
      <div className="font-medium">{product.name}</div>
      <div className="text-sm text-gray-500">{product.slug}</div>
    </div>
  );
}
```

### Step 2: Create status-badge.tsx

```tsx
import { cn } from "@repo/shared-utils/cn";

interface StatusBadgeProps {
  status: "draft" | "published" | "archived";
}

const statusStyles = {
  draft: "bg-gray-100 text-gray-800",
  published: "bg-green-100 text-green-800",
  archived: "bg-red-100 text-red-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

### Step 3: Create relative-time-cell.tsx

```tsx
import { formatRelativeTime } from "@repo/shared-utils/format";

interface RelativeTimeCellProps {
  date: string;
}

export function RelativeTimeCell({ date }: RelativeTimeCellProps) {
  return <span>{formatRelativeTime(date)}</span>;
}
```

### Step 4: Create table-toolbar.tsx

```tsx
import { Input } from "@repo/ui/base-ui";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAdd: () => void;
}

export function TableToolbar({
  search,
  onSearchChange,
  onAdd,
}: TableToolbarProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <Input
        type="text"
        placeholder="Search products..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="max-w-sm"
      />
      <button
        onClick={onAdd}
        className="rounded-md bg-blue-600 px-4 py-2 text-white"
      >
        Add Product
      </button>
    </div>
  );
}
```

### Step 5: Create table-pagination.tsx

```tsx
interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-gray-500">
        Showing {Math.min(page * pageSize, total)} of {total} products
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-md border px-2 py-1"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border px-3 py-1"
        >
          Previous
        </button>
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border px-3 py-1"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Step 6: Create product-table.tsx

```tsx
import { DataTable } from "@/components/ui/data-table";
import { Product } from "@repo/tenant-orm/types";
import { ProductNameCell } from "./product-name-cell";
import { StatusBadge } from "./status-badge";
import { RelativeTimeCell } from "./relative-time-cell";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  search: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange: (search: string) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductTable({
  products,
  loading,
  total,
  page,
  pageSize,
  search,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onEdit,
  onDelete,
}: ProductTableProps) {
  const columns = [
    {
      header: "Product",
      accessor: (product: Product) => <ProductNameCell product={product} />,
    },
    {
      header: "Status",
      accessor: (product: Product) => <StatusBadge status={product.status} />,
    },
    {
      header: "Weight",
      accessor: (product: Product) =>
        product.weight ? `${product.weight} ${product.weight_unit}` : "—",
    },
    {
      header: "Updated",
      accessor: (product: Product) => (
        <RelativeTimeCell date={product.updated_at} />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={products}
      loading={loading}
      search={search}
      onSearchChange={onSearchChange}
      pagination={{ page, pageSize, total }}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      actions={(product: Product) => [
        {
          label: "Edit",
          onClick: () => onEdit(product),
        },
        {
          label: "Delete",
          onClick: () => onDelete(product),
          variant: "destructive",
        },
      ]}
    />
  );
}
```

- [ ] **Step 7: Verify table components render correctly**

Run: `cd apps/admin && npm run dev`

Expected: Product table shows name, slug, status, weight, updated time, and actions.

---

## Task 7: Create Product Drawer & Delete Dialog

**Files:**

- Create: `apps/admin/src/components/products/product-drawer.tsx`
- Create: `apps/admin/src/components/products/product-delete-dialog.tsx`

**Interfaces:**

- Consumes: `ProductForm`, `ProductDeleteDialog`, Base UI `Dialog`.
- Produces: Slide-out drawer for Create/Edit, confirmation dialog for Delete.

### Step 1: Create product-drawer.tsx

```tsx
import { Dialog } from "@repo/ui/base-ui";
import { Product } from "@repo/tenant-orm/types";
import { ProductForm } from "./product-form";

interface ProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Product;
  onSubmit: (data: any) => void;
  title: string;
}

export function ProductDrawer({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  title,
}: ProductDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="fixed right-0 top-0 h-full w-96 bg-white p-6 shadow-lg">
        <Dialog.Header>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body>
          <ProductForm
            initialData={initialData}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </Dialog.Body>
      </div>
    </Dialog>
  );
}
```

### Step 2: Create product-delete-dialog.tsx

```tsx
import { Dialog } from "@repo/ui/base-ui";
import { Product } from "@repo/tenant-orm/types";
import { Button } from "@/components/ui/button";

interface ProductDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  onConfirm: () => void;
}

export function ProductDeleteDialog({
  open,
  onOpenChange,
  product,
  onConfirm,
}: ProductDeleteDialogProps) {
  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Header>
        <Dialog.Title>Delete Product</Dialog.Title>
      </Dialog.Header>
      <Dialog.Body>
        <p>Are you sure you want to delete "{product.name}"?</p>
        <p className="text-sm text-gray-500">This action cannot be undone.</p>
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          Delete
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
```

- [ ] **Step 3: Verify drawer and dialog render correctly**

Run: `cd apps/admin && npm run dev`

Expected: Drawer slides in from right with form, delete dialog shows confirmation.

---

## Task 8: Create use-products Hook & RBAC Types

**Files:**

- Create: `apps/admin/src/hooks/use-products.ts`
- Create: `apps/admin/src/types/rbac.ts`

**Interfaces:**

- Consumes: API client, Product type, React Query.
- Produces: Custom hook for product CRUD operations, RBAC type definitions.

### Step 1: Create use-products.ts

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Product } from "@repo/tenant-orm/types";

export function useProducts() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const response = await api.get("/api/v1/products/");
      return response.json() as Promise<Product[]>;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post("/api/v1/products/", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/api/v1/products/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
```

### Step 2: Create types/rbac.ts

```typescript
export type Role = "admin" | "member" | "viewer";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: ["create", "read", "update", "delete"],
  member: ["create", "read", "update"],
  viewer: ["read"],
};

export function can(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

- [ ] **Step 3: Verify hooks and types work correctly**

Run: `cd apps/admin && npm run dev`

Expected: Products page loads data, mutations work, RBAC checks pass.

---

## Task 9: Update Products Page with New Components

**Files:**

- Modify: `apps/admin/src/app/(app)/products/page.tsx`

**Interfaces:**

- Consumes: `useProducts`, `ProductTable`, `ProductDrawer`, `ProductDeleteDialog`.
- Produces: Fully integrated CRUD page with all components.

### Step 1: Rewrite products page with new components

- [ ] **Step 1: Update products/page.tsx**

```tsx
"use client";

import { useState } from "react";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/use-products";
import { useRbac } from "@/contexts/rbac-context";
import { ProductTable } from "@/components/products/product-table";
import { ProductDrawer } from "@/components/products/product-drawer";
import { ProductDeleteDialog } from "@/components/products/product-delete-dialog";
import { Product } from "@repo/tenant-orm/types";

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const { can } = useRbac();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleCreate = () => {
    setSelectedProduct(null);
    setDrawerOpen(true);
  };

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setDrawerOpen(true);
  };

  const handleDelete = (product: Product) => {
    setSelectedProduct(product);
    setDeleteOpen(true);
  };

  const handleDrawerSubmit = (data: any) => {
    if (selectedProduct) {
      updateMutation.mutate({ id: selectedProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
    setDrawerOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (selectedProduct) {
      deleteMutation.mutate(selectedProduct.id);
    }
    setDeleteOpen(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Products</h1>
      <ProductTable
        products={products || []}
        loading={isLoading}
        total={products?.length || 0}
        page={1}
        pageSize={10}
        search=""
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
        onSearchChange={() => {}}
        onAdd={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <ProductDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        initialData={selectedProduct || undefined}
        onSubmit={handleDrawerSubmit}
        title={selectedProduct ? "Edit Product" : "Create Product"}
      />
      <ProductDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        product={selectedProduct}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify products page renders with all components**

Run: `cd apps/admin && npm run dev`

Expected: Products page shows table, drawer, and delete dialog working.

---

## Verification Checklist

- [ ] All TS errors resolved (no `can("edit")`, no `price` references)
- [ ] Layout renders with providers composed in AppShell
- [ ] Header shows tenant pill and role badge
- [ ] Product form has all fields, uses Base UI Switch
- [ ] Product table renders with all cell components
- [ ] Drawer slides in/out correctly
- [ ] Delete dialog works
- [ ] Products page integrates all components
- [ ] RBAC permissions work correctly
- [ ] Frontend/backend schemas aligned

---

## Commit Strategy

1. **Commit 1:** Fix layout & provider composition (Task 1)
2. **Commit 2:** Fix RBAC bug (Task 2)
3. **Commit 3:** Update header with tenant/role indicators (Task 3)
4. **Commit 4:** Align frontend/backend schemas (Task 4)
5. **Commit 5:** Complete product form (Task 5)
6. **Commit 6:** Create table components (Task 6)
7. **Commit 7:** Create drawer & delete dialog (Task 7)
8. **Commit 8:** Create hooks & types (Task 8)
9. **Commit 9:** Update products page (Task 9)

Each commit should be small, focused, and include verification steps.
