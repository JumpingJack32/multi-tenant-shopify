# Implementation Plan: Multi-Tenant Product CRUD UI

## Overview

Build a complete multi-tenant Product CRUD interface in the admin app demonstrating:

- Left sidebar navigation with tenant switcher
- Data table with search, filter, pagination, and bulk actions
- Right-side slide-out drawer for Create/Edit forms
- AlertDialog for delete confirmation
- 3-tier RBAC (Admin/Member/Viewer) controlling action visibility
- React Query for server state management
- Base UI + Tailwind v4 components

## Phase 1: Foundation & Infrastructure

### 1.1 Align Frontend/Backend Product Schemas

**Files:** `packages/tenant-orm/src/types.ts`, `packages/tenant-orm/src/schemas/tenant.ts`

**Problem:** Frontend `Product` has `price`, backend has `slug`, `weight`, `is_active`, no `price`. Status enums differ (`"active"` vs `"published"`).

**Action:** Update frontend types to match backend schema:

- Add `slug: string`, `weight: number | null`, `weight_unit: string`, `is_active: boolean`
- Remove `price: number`
- Change status `"active"` → `"published"`
- Update `ProductSchema` and `ProductCreateSchema` Zod schemas accordingly

### 1.2 Create API Client Layer

**File:** `apps/admin/src/lib/api/client.ts`

**Action:** Build a typed fetch wrapper with:

- Automatic Clerk token injection via `getToken()` from `@clerk/nextjs`
- `X-Tenant-ID` header from current tenant context
- Generic `request<T>(url, options)` method
- `products` namespace: `list()`, `get()`, `create()`, `update()`, `delete()`
- Error handling with typed error responses

### 1.3 Create Tenant Context Provider

**File:** `apps/admin/src/contexts/tenant-context.tsx`

**Action:** Build a React context that:

- Stores `currentTenantId` and `tenantList` (array of available tenants)
- Provides `setTenant(tenantId)` switcher function
- Persists selected tenant to `sessionStorage`
- Fetches user's tenant memberships from backend on mount
- Provides `useTenantContext()` hook

### 1.4 Create RBAC Context Provider

**File:** `apps/admin/src/contexts/rbac-context.tsx`

**Action:** Build a React context that:

- Extracts user roles from Clerk session metadata (`useAuth().sessionClaims?.metadata?.roles`)
- Provides `hasPermission(action: "create" | "read" | "update" | "delete"): boolean`
- Provides `useRbac()` hook with role constants: `ADMIN`, `MEMBER`, `VIEWER`
- Falls back to `"viewer"` if no roles found

## Phase 2: Layout & Navigation

### 2.1 Create Sidebar Component

**File:** `apps/admin/src/components/layout/sidebar.tsx`

**Action:** Build a collapsible left sidebar with:

- Logo/brand area at top
- Tenant switcher dropdown (uses Base UI `Select` + `Popover`)
- Navigation links: Dashboard, Products, Orders, Settings
- Collapsible sections with chevron icons (Base UI `Collapsible`)
- Responsive: collapses to icon-only on small screens, hidden behind hamburger on mobile
- Uses `@repo/ui/base-ui` for `Select`, `Popover`, `Collapsible`

### 2.2 Create App Shell Layout

**File:** `apps/admin/src/components/layout/app-shell.tsx`

**Action:** Build the main layout wrapper:

- Left sidebar (fixed width, collapsible)
- Main content area (flex-1, scrollable)
- Top header bar (from existing `Header` component, moved into shell)
- Provider composition: `TenantProvider` + `RbacProvider` + `QueryClientProvider`
- Used as the layout for `/products/*` routes

### 2.3 Update Root Layout

**File:** `apps/admin/src/app/layout.tsx`

**Action:**

- Move `QueryClientProvider` into the app shell (keep in root for auth pages)
- Wrap `/products/*` routes with `AppShell`
- Keep `/auth/*` routes un-wrapped (no sidebar needed)

## Phase 3: Data Table

### 3.1 Create Table Components

**Files:**

- `apps/admin/src/components/products/product-table.tsx`
- `apps/admin/src/components/products/table-pagination.tsx`
- `apps/admin/src/components/products/table-toolbar.tsx`

**Action:** Build a data table with:

- **Columns:** Checkbox, Name, SKU, Status (badge), Price/Weight, Updated (relative time), Actions (ellipsis menu)
- **Toolbar:** Search input (Base UI `Input`), status filter dropdown (Base UI `Select`), "+ Add Product" button (hidden by RBAC)
- **Pagination:** Page size selector, prev/next buttons, page indicator
- **Row actions:** Ellipsis menu (Base UI `Menu`) with Edit/Delete (hidden by RBAC)
- **Status badges:** Color-coded (draft=gray, active=purple, archived=blue)
- **Loading state:** Skeleton rows while data loads
- **Empty state:** Illustration + "No products yet" + "Add Product" button
- **Data fetching:** `useQuery` with `@tanstack/react-query` → `api.products.list()`

### 3.2 Create Product Cell Components

**Files:**

- `apps/admin/src/components/products/product-name-cell.tsx`
- `apps/admin/src/components/products/status-badge.tsx`
- `apps/admin/src/components/products/relative-time-cell.tsx`

**Action:**

- `StatusBadge`: Renders colored badge based on product status using Base UI primitives
- `RelativeTimeCell`: Uses `formatRelativeTime()` from `@repo/shared-utils/format`
- `ProductNameCell`: Clickable link to edit (if user has update permission)

## Phase 4: Forms & Drawer

### 4.1 Create Drawer Component

**File:** `apps/admin/src/components/products/product-drawer.tsx`

**Action:** Build a right-side slide-out drawer using Base UI `Drawer`:

- Width: ~480px (fixed), slides in from right
- Backdrop overlay (clickable to close)
- Header: Title ("Create Product" / "Edit Product") + Close button
- Body: Form fields (delegated to `ProductForm`)
- Footer: Sticky bottom with "Cancel" (ghost) and "Save" (default) buttons
- Shows tenant lock indicator in header (disabled field showing current tenant name)
- Controlled via `open` prop + `onOpenChange` callback

### 4.2 Create Product Form

**File:** `apps/admin/src/components/products/product-form.tsx`

**Action:** Build a form with react-hook-form + Zod validation:

- **Fields:**
  - Product Name (required, min 1 char, max 255)
  - Slug (required, auto-generated from name, editable)
  - Description (optional, textarea)
  - SKU (optional)
  - Status (dropdown: draft/published/archived)
  - Weight (optional, number)
  - Weight Unit (dropdown: kg/lb/g)
  - Active (toggle switch, Base UI `Switch`)
- **Validation:** Zod schema matching `ProductCreateSchema` / `ProductUpdateSchema`
- **Submit:** Calls `api.products.create()` or `api.products.update()` via React Query mutation
- **Loading state:** Disable submit button while submitting
- **Error display:** Show API errors in a toast (Base UI `Toast`)
- **Tenant field:** Read-only, shows current tenant name (from context)

### 4.3 Create Delete Confirmation

**File:** `apps/admin/src/components/products/product-delete-dialog.tsx`

**Action:** Build a delete confirmation using Base UI `AlertDialog`:

- Title: "Delete Product"
- Description: "Are you sure you want to delete '{productName}'? This action cannot be undone."
- Actions: "Cancel" (ghost) + "Delete" (destructive)
- On confirm: Calls `api.products.delete()` via React Query mutation
- Invalidates product list query on success
- Shows success/error toast

## Phase 5: RBAC Integration

### 5.1 Wire RBAC to UI Actions

**Files:** Updated across all product components

**Action:**

- `+ Add Product` button: hidden if `!hasPermission("create")`
- Row Edit action: hidden if `!hasPermission("update")`
- Row Delete action: hidden if `!hasPermission("delete")`
- Product name cell: not clickable if `!hasPermission("update")`
- Drawer form: disabled if `!hasPermission("update")` (shows "Viewing as Viewer" banner)

### 5.2 Extract Roles from Clerk

**File:** `apps/admin/src/contexts/rbac-context.tsx`

**Action:**

- Use `useAuth()` to access `sessionClaims`
- Extract `metadata.roles` array from Clerk session claims
- Map Clerk roles to internal roles: `["admin"]` → `ADMIN`, `["member"]` → `MEMBER`, `["viewer"]` → `VIEWER`
- Default to `VIEWER` if no roles found
- Provide `useRbac()` hook with `can(action)` method

## Phase 6: Routes & Wiring

### 6.1 Create Products Route

**File:** `apps/admin/src/app/products/page.tsx`

**Action:** Build the main products page:

- Wraps content in `AppShell` layout
- Renders `ProductTable` with full data fetching
- Manages drawer state (`open`, `mode: "create" | "edit"`, `productId`)
- Renders `ProductDrawer` when open
- Renders `ProductDeleteDialog` when delete confirmed
- Uses `useMutation` for create/update/delete (invalidates list query on success)

### 6.2 Update Header

**File:** `apps/admin/src/components/layout/header.tsx`

**Action:**

- Keep existing sign-in/sign-out logic
- Add tenant indicator pill (shows current tenant name, clickable to switch)
- Show user role badge (Admin/Member/Viewer) next to UserButton

## File Structure

```
apps/admin/src/
├── app/
│   ├── layout.tsx                          # Root layout (QueryClientProvider, ClerkProvider)
│   ├── page.tsx                            # Dashboard (placeholder)
│   └── products/
│       └── page.tsx                        # Products CRUD page
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx                   # Sidebar + main content shell
│   │   ├── header.tsx                      # Top header (auth + tenant indicator)
│   │   └── sidebar.tsx                     # Left sidebar nav + tenant switcher
│   └── products/
│       ├── product-table.tsx               # Data table with search/filter/pagination
│       ├── table-toolbar.tsx               # Search bar + filter + add button
│       ├── table-pagination.tsx            # Pagination controls
│       ├── product-drawer.tsx              # Right-side slide-out form drawer
│       ├── product-form.tsx                # Form fields with validation
│       ├── product-delete-dialog.tsx       # AlertDialog for delete confirmation
│       ├── status-badge.tsx                # Colored status badges
│       ├── product-name-cell.tsx           # Clickable product name cell
│       └── relative-time-cell.tsx          # Relative time formatting
├── contexts/
│   ├── tenant-context.tsx                  # Tenant selection + switching
│   └── rbac-context.tsx                    # Role-based access control
├── hooks/
│   ├── use-tenant.ts                       # Existing tenant query hook (keep)
│   └── use-products.ts                     # Product data fetching hooks
├── lib/
│   ├── api/
│   │   └── client.ts                       # Typed API client with auth headers
│   └── utils.ts                            # Existing cn utility
└── types/
    └── rbac.ts                             # RBAC role type definitions
```

## Dependencies Already Available

- `@clerk/nextjs` v7.5.7 — auth
- `@tanstack/react-query` — server state
- `@base-ui/react` — UI primitives (re-exported via `@repo/ui/base-ui`)
- `zod` + `react-hook-form` — form validation (in dependency tree)
- `date-fns` — date formatting
- `tailwindcss` v4 — styling

## Key Technical Decisions

1. **Base UI over Radix:** All overlays, menus, dialogs use `@base-ui/react` (not Radix). Field uses `<div>` wrapper, not Base UI `Field` (which doesn't support children).
2. **React Query for mutations:** All CRUD operations use `useMutation` with automatic query invalidation.
3. **Clerk session claims for RBAC:** Roles stored in Clerk session metadata, extracted client-side.
4. **Tenant context via React Context:** Not URL-based; persists to sessionStorage; switchable via dropdown.
5. **Drawer over modal:** Right-side drawer preserves list context during create/edit.
6. **API client abstraction:** Centralized fetch wrapper handles auth token + tenant header injection.
7. **Form validation:** Zod schemas mirror backend schemas for consistency.
