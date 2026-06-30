# OpenCode Design System Rules (DESIGN.md)

## 1. System Priorities

* **Performance:** No layout shifts (CLS), clean semantic HTML, and native CSS.

* **Accessibility:** Strict WCAG 2.2 AA compliance, full keyboard navigation, and aria attributes.

* **Consistency:** Strict adherence to the tokens and layout rules defined below.

## 2. Design Tokens & Variables

### Color Palette (Light / Dark Mode)

Color pallete to be found in `packages/ui/src/styles/globals.css`

### Typography Scale

* **Font Family:** Inter, system-ui, sans-serif (fallbacks)

* **Heading 1:** 2.25rem (36px) | Line Height: 1.2 | Bold

* **Heading 2:** 1.5rem (24px) | Line Height: 1.3 | Semi-Bold

* **Body Text:** 1.0rem (16px) | Line Height: 1.5 | Regular

* **Small/Caption:** 0.875rem (14px) | Line Height: 1.4 | Regular

### Spacing & Layout Grid

* **Base Unit:** 4px (All spacing must use multiples of 4: 4, 8, 12, 16, 24, 32, 48, 64)
* **Component Padding:** 16px (1rem) desktop | 12px mobile
* **Page Margin:** 24px desktop | 16px mobile
* **Grid System:** Flexbox for components, CSS Grid for page layouts

## 3. Interactive Component Requirements

### Interactive States
Every clickable or interactable element must explicitly define four states:
1.  **Default:** Standard token values.
2.  **Hover:** `--accent-hover` or slightly adjusted background opacity.
3.  **Focus:** Minimum `2px solid var(--accent)` outline with `2px` offset. Do not hide default focus outlines without a custom alternative.
4.  **Disabled:** `opacity: 0.5; cursor: not-allowed;` with pointer-events disabled.

### Loading & Error States
*   **Buttons:** Show a localized spinner, keep width fixed, disable clicks during loading.
*   **Data Views:** Use skeleton screens matching the exact layout structure instead of a single text loader.
*   **Errors:** Display inline error text below fields in `--error` color with an appropriate warning icon.

## 4. OpenCode Generation Constraints
*   **No Placeholders:** Do not write `// TODO: add styles here` or use generic alert boxes.
*   **No Component Over-engineering:** Write vanilla CSS/Tailwind utilities before reaching for heavy third-party UI libraries.
*   **State Management:** Keep state local to the component unless global coordination is strictly required.
----------

# OpenCode Design System Rules & Code Templates

## 1. Monorepo & Engine Priorities

* **Context Scoping:** Constrain scans strictly to `packages/ui/src/**/*` and the calling application directory (e.g., `apps/admin/**/*`).
* **Architecture:** Leverage Next.js 16.2 Server Components (RSC) by default. Use client wrappers (`"use client"`) strictly for interactive input primitives and state-bound actions.
* **Library Directives:** Scaffold visual styles using Tailwind CSS v4 syntax. Handle behavior primitives using Base UI (`@base-ui/react`) and structural styling via Shadcn components.

## 2. Tailwind CSS v4 Global Configuration

The following design variables are baked directly into your `packages/ui/src/styles/globals.css` using the updated native `@theme` engine:

```css
@import "tailwindcss";

@theme {
...
}
```

---;

## 3. High-Utility Component Wireframes

### A. E-Commerce Backend Inventory Form

*When tasked with managing catalog inventory items, instantiate this React Server Action compatible form layer inside your seller/store layout path:*

```tsx
// apps/admin/app/[tenantId]/inventory/new/page.tsx
import { Form } from "@base-ui/react/form"; 
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";

export default async function NewInventoryItemPage({ params }) {
  const { tenantId } = await params;

  async function handleInventorySubmit(formData: FormData) {
    "use server";
    // Server action logic handles catalog item payload scoped by tenantId
    const data = {
      sku: formData.get("sku"),
      stockCount: Number(formData.get("stockCount")),
      price: Number(formData.get("price")),
      tenantId,
    };
    // Revalidate and update inventory states natively
  }

  return (
    <div className="max-w-2xl p-6 bg-background rounded-lg border border-border">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Add Catalog Item</h1>
        <p className="text-sm text-muted-foreground">Tenant Workspace ID: {tenantId}</p>
      </div>

      <Form action={handleInventorySubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Stock Keeping Unit (SKU)</label>
            <Input name="sku" placeholder="e.g. TS-BLK-XL" required />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Initial Inventory Count</label>
            <Input name="stockCount" type="number" min="0" placeholder="0" required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Retail Unit Price</label>
            <Input name="price" type="number" step="0.01" placeholder="0.00" required />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button type="submit" className="bg-accent text-accent-foreground hover:opacity-90 transition-opacity">
            Save to Inventory
          </Button>
        </div>
      </Form>
    </div>
  );
}
```

### B. Multi-Tenant Navigation Dashboard

*For high-level workspace control planes, match this multi-app architecture. This layout features global tenant switching alongside standard cross-app routing hooks:*

```tsx
// apps/admin/app/[tenantId]/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}

export default async function TenantDashboardLayout({ children, params }: DashboardLayoutProps) {
  const { tenantId } = await params;

  // Validate tenant context presence in cross-cutting multi-tenant middleware layer
  if (!tenantId) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Structural Sidebar Panel */}
      <aside className="w-64 border-r border-border bg-muted/30 flex flex-col p-4">
        <div className="pb-4 mb-6 border-b border-border flex items-center justify-between">
          <div className="font-bold tracking-tight text-brand-primary">Console Suite</div>
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
            {tenantId}
          </span>
        </div>

        <nav className="space-y-1.5 flex-1">
          <Link 
            href={`/${tenantId}/dashboard`} 
            className="flex items-center px-3 py-2 text-sm rounded-md hover:bg-muted text-foreground transition-colors"
          >
            Overview Node
          </Link>
          <Link 
            href={`/${tenantId}/inventory`} 
            className="flex items-center px-3 py-2 text-sm rounded-md hover:bg-muted text-foreground transition-colors"
          >
            Inventory Master
          </Link>
          <Link 
            href={`/${tenantId}/settings/organization`} 
            className="flex items-center px-3 py-2 text-sm rounded-md bg-accent text-accent-foreground font-medium"
          >
            Tenant Settings
          </Link>
        </nav>
      </aside>

      {/* Primary Layout Engine Context Workspace */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background">
          <div className="text-sm font-medium text-muted-foreground">
            System Workspace / Organization Meta
          </div>
        </header>
        
        <div className="p-6 flex-1 bg-background">
          {children}
        </div>
      </main>
    </div>
  );
}
```

---;

## 4. Generation Constraints

* **Workspace Resolution:** Use the `@workspace/ui` path alias when fetching components from the monorepo package tree.
* **Validation Boundaries:** Enforce explicit type bindings via `TypeScript` across all Next.js async page/layout parameters.
