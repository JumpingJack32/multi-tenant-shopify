# Admin UI Working Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the admin dashboard from a static mockup into a functional, error-free interface.

**Architecture:** Next.js App Router with Clerk auth, react-query data layer, Tailwind v4 CSS. Tasks ordered by dependency: build fix → polish → features → tests.

**Tech Stack:** Next.js 16, Clerk v7, @tanstack/react-query, @base-ui/react, Tailwind v4, zod, react-hook-form, vitest

## Global Constraints

- All secrets come from Doppler — never hardcode env vars
- Use `doppler run -- pnpm turbo run dev` (wrapped as `pnpm dev` at root)
- Pre-existing patterns: ProductTable component for table reference, RBAC/Tenant contexts for state management
- API base: `NEXT_PUBLIC_API_URL` (default http://localhost:8000/api/v1)

---

### Task A: Fix Build — Resolve TS Error

**Files:**

- Modify: `apps/admin/src/features/products/hooks/__tests__/use-products.test.tsx`

- [ ] **Step 1: Read current test to understand the mock shape**

```bash
code apps/admin/src/features/products/hooks/__tests__/use-products.test.tsx
```

- [ ] **Step 2: Update mock data to include all required Product fields**

Replace the partial mock with a complete Product object:

```tsx
const mockProducts: Product[] = [
  {
    id: "1",
    tenant_id: "tenant-1",
    name: "Product A",
    slug: "product-a",
    description: "A test product",
    sku: "SKU-001",
    status: "published",
    weight: 1.5,
    weight_unit: "kg",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];
```

Import `Product` at the top:

```tsx
import type { Product } from "@repo/tenant-orm/types";
```

- [ ] **Step 3: Run typecheck to verify the fix**

```bash
cd apps/admin && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run admin tests to verify nothing broke**

```bash
pnpm vitest run --project admin
```

Expected: 3 passed (RBAC context, use-products, (none failing)).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/features/products/hooks/__tests__/use-products.test.tsx
git commit -m "fix(admin): add missing Product fields in test mock data"
```

---

### Task D1: Functional Polish — API Error Banner

**Files:**

- Create: `apps/admin/src/components/ui/error-banner.tsx`

- [ ] **Step 1: Create ErrorBanner component**

`apps/admin/src/components/ui/error-banner.tsx`:

```tsx
interface ErrorBannerProps {
  message?: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <svg
        className="h-5 w-5 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 hover:bg-red-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Use ErrorBanner in products page**

Wrap the fetch error in `apps/admin/src/app/(app)/products/page.tsx`:

```tsx
const { data: productsData, isLoading, isError, error } = useProducts({
```

Add after the header section:

```tsx
{
  isError && (
    <ErrorBanner
      message={
        error instanceof Error ? error.message : "Failed to load products"
      }
    />
  );
}
```

Import at top:

```tsx
import { ErrorBanner } from "@/components/ui/error-banner";
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/ui/error-banner.tsx apps/admin/src/app/\(app\)/products/page.tsx
git commit -m "feat(admin): add ErrorBanner component for API failure handling"
```

---

### Task D2: Functional Polish — Loading & Empty States

**Files:**

- Modify: `apps/admin/src/app/(app)/orders/page.tsx`

- [ ] **Step 1: Add loading skeleton and empty state to orders page**

```bash
mkdir -p apps/admin/src/components/orders
```

Create `apps/admin/src/components/orders/orders-table-skeleton.tsx`:

```tsx
export function OrdersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {["Customer", "Status", "Total", "Date"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-medium text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-t">
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Update `apps/admin/src/app/(app)/orders/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { OrdersTableSkeleton } from "@/components/orders/orders-table-skeleton";

export default function OrdersPage() {
  const [loading] = useState(true);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">View and manage orders</p>
      </div>

      {loading ? (
        <OrdersTableSkeleton />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="mb-4 h-12 w-12 text-muted-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="text-lg font-medium">No orders yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders will appear here once customers start purchasing.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(app\)/orders/page.tsx apps/admin/src/components/orders/orders-table-skeleton.tsx
git commit -m "feat(admin): add loading skeleton and empty state to orders page"
```

---

### Task B1: Features — Orders Page

**Files:**

- Modify: `apps/admin/src/app/(app)/orders/page.tsx`
- Create: `apps/admin/src/components/orders/orders-table.tsx`

- [ ] **Step 1: Create OrdersTable component**

`apps/admin/src/components/orders/orders-table.tsx`:

```tsx
"use client";

interface Order {
  id: string;
  customer_email: string;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total: number;
  created_at: string;
}

interface OrdersTableProps {
  orders: Order[];
  loading: boolean;
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

export function OrdersTable({ orders, loading }: OrdersTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg
          className="mb-4 h-12 w-12 text-muted-foreground/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="text-lg font-medium">No orders yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Orders will appear here once customers start purchasing.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Customer
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Total
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => (
            <tr key={order.id} className="transition-colors hover:bg-accent/50">
              <td className="px-4 py-3 font-medium">{order.customer_email}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[order.status] ?? "bg-gray-100 text-gray-800"}`}
                >
                  {order.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                ${(order.total / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {new Date(order.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Update orders page to use OrdersTable**

Replace `apps/admin/src/app/(app)/orders/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { OrdersTable } from "@/components/orders/orders-table";

// Placeholder data until backend is connected
const PLACEHOLDER_ORDERS: Order[] = [];

export default function OrdersPage() {
  const [loading] = useState(false);
  const [orders] = useState<Order[]>(PLACEHOLDER_ORDERS);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">View and manage orders</p>
      </div>
      <OrdersTable orders={orders} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/components/orders/orders-table.tsx apps/admin/src/app/\(app\)/orders/page.tsx
git commit -m "feat(admin): implement orders table with status badges and empty state"
```

---

### Task B2: Features — Settings Page

**Files:**

- Modify: `apps/admin/src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Implement settings form**

Replace `apps/admin/src/app/(app)/settings/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";

export default function SettingsPage() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      // Placeholder — replaces with actual API call when backend is connected
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your store</p>
      </div>

      <div className="max-w-lg space-y-6">
        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Settings saved successfully.
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="store-name" className="text-sm font-medium">
              Store Name
            </label>
            <input
              id="store-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="My Store"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="store-slug" className="text-sm font-medium">
              Slug
            </label>
            <input
              id="store-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="my-store"
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/\(app\)/settings/page.tsx
git commit -m "feat(admin): implement settings page with store name and slug form"
```

---

### Task B3: Verify Sidebar Navigation

**Files:**

- Verify-only: `apps/admin/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Run dev server and verify sidebar links**

```bash
pnpm dev
```

Navigate to:

- `/dashboard` — sidebar "Dashboard" should highlight
- `/products` — sidebar "Products" should highlight
- `/orders` — sidebar "Orders" should highlight
- `/settings` — sidebar "Settings" should highlight

Verify no 404s. Verify active state uses `bg-accent text-accent-foreground`.

The sidebar already has: Dashboard, Products, Orders, Settings links with `usePathname()` active highlighting. No code changes expected — confirm visually.

---

### Task C1: Tests — Tenant Context

**Files:**

- Create: `apps/admin/src/contexts/__tests__/tenant-context.test.tsx`

- [ ] **Step 1: Write tenant-context tests**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TenantProvider, useTenantContext } from "../tenant-context";

// Mock Clerk's dynamic import
vi.mock("@clerk/nextjs", () => ({
  getToken: vi.fn().mockResolvedValue("mock-token"),
}));

function TestConsumer() {
  const ctx = useTenantContext();
  return (
    <div>
      <div data-testid="tenant-id">{ctx.currentTenantId}</div>
      <div data-testid="is-loading">{String(ctx.isLoading)}</div>
    </div>
  );
}

describe("TenantProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("renders children", () => {
    render(
      <TenantProvider>
        <div data-testid="child">Hello</div>
      </TenantProvider>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("provides null tenant ID by default", () => {
    render(
      <TenantProvider>
        <TestConsumer />
      </TenantProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("");
  });

  it("throws useTenantContext outside provider", () => {
    expect(() => render(<TestConsumer />)).toThrow(
      "useTenantContext must be used within a TenantProvider",
    );
  });
});
```

- [ ] **Step 2: Run admin tests**

```bash
pnpm vitest run --project admin
```

Expected: 4+ passed (existing RBAC + new tenant-context tests).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/contexts/__tests__/tenant-context.test.tsx
git commit -m "test(admin): add TenantProvider tests"
```

---

### Task C2: Tests — Product Table

**Files:**

- Create: `apps/admin/src/components/products/__tests__/product-table.test.tsx`

- [ ] **Step 1: Write product-table tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductTable } from "../product-table";
import type { Product } from "@repo/tenant-orm/types";

const mockProducts: Product[] = [
  {
    id: "1",
    tenant_id: "t1",
    name: "Test Product",
    slug: "test-product",
    description: "A test",
    sku: "SKU-1",
    status: "published",
    weight: 1.0,
    weight_unit: "kg",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("ProductTable", () => {
  it("renders product rows", () => {
    render(
      <ProductTable
        products={mockProducts}
        loading={false}
        total={1}
        page={1}
        pageSize={20}
        search=""
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Test Product")).toBeDefined();
    expect(screen.getByText("published")).toBeDefined();
  });

  it("shows loading spinner", () => {
    render(
      <ProductTable
        products={[]}
        loading={true}
        total={0}
        page={1}
        pageSize={20}
        search=""
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("shows empty state", () => {
    render(
      <ProductTable
        products={[]}
        loading={false}
        total={0}
        page={1}
        pageSize={20}
        search=""
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("No products found.")).toBeDefined();
  });

  it("calls onEdit when edit button clicked", () => {
    const onEdit = vi.fn();
    render(
      <ProductTable
        products={mockProducts}
        loading={false}
        total={1}
        page={1}
        pageSize={20}
        search=""
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEdit={onEdit}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(mockProducts[0]);
  });

  it("calls onDelete when delete button clicked", () => {
    const onDelete = vi.fn();
    render(
      <ProductTable
        products={mockProducts}
        loading={false}
        total={1}
        page={1}
        pageSize={20}
        search=""
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onSearchChange={vi.fn()}
        onEdit={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(mockProducts[0]);
  });
});
```

- [ ] **Step 2: Run admin tests**

```bash
pnpm vitest run --project admin
```

Expected: 9+ passed.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/products/__tests__/product-table.test.tsx
git commit -m "test(admin): add ProductTable component tests"
```

---

### Task C3: Tests — Sign-in Page

**Files:**

- Create: `apps/admin/src/app/auth/sign-in/__tests__/sign-in-page.test.tsx`

- [ ] **Step 1: Write sign-in page tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SignInPage from "../page";

// Mock Clerk hooks
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true }),
  useSignIn: () => ({
    signIn: {
      create: vi.fn(),
      finalize: vi.fn(),
    },
  }),
  useClerk: () => ({}),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("SignInPage", () => {
  it("renders sign-in form", () => {
    render(<SignInPage />);
    expect(screen.getByText("Sign in to Admin")).toBeDefined();
    expect(screen.getByText("Continue with Google")).toBeDefined();
    expect(screen.getByText("Continue with GitHub")).toBeDefined();
  });

  it("renders email and password inputs", () => {
    render(<SignInPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeDefined();
    expect(screen.getByPlaceholderText("••••••••")).toBeDefined();
  });

  it("has a sign-in button", () => {
    render(<SignInPage />);
    expect(screen.getByText("Sign in")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run admin tests**

```bash
pnpm vitest run --project admin
```

Expected: 12+ passed.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/app/auth/sign-in/__tests__/sign-in-page.test.tsx
git commit -m "test(admin): add sign-in page rendering tests"
```

---

### Task C4: Tests — Product Form

**Files:**

- Create: `apps/admin/src/components/products/__tests__/product-form.test.tsx`

- [ ] **Step 1: Write product-form tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductForm } from "../product-form";

describe("ProductForm", () => {
  it("renders form fields for create mode", () => {
    render(<ProductForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Product Name")).toBeDefined();
    expect(screen.getByText("Slug")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Create Product")).toBeDefined();
  });

  it("calls onCancel when cancel clicked", () => {
    const onCancel = vi.fn();
    render(<ProductForm onSubmit={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders update mode with initial data", () => {
    render(
      <ProductForm
        initialData={{
          id: "1",
          tenant_id: "t1",
          name: "Existing",
          slug: "existing",
          description: null,
          sku: null,
          status: "draft",
          weight: null,
          weight_unit: "kg",
          is_active: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Update Product")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run admin tests**

```bash
pnpm vitest run --project admin
```

Expected: 15+ passed.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/components/products/__tests__/product-form.test.tsx
git commit -m "test(admin): add ProductForm component tests"
```

---

### Verification

- [ ] **Full typecheck**

```bash
cd apps/admin && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Full test suite**

```bash
pnpm vitest run
```

Expected: All tests pass.

- [ ] **Dev server starts clean**

```bash
pnpm dev
```

Expected: Server starts, all routes render without crashes.
