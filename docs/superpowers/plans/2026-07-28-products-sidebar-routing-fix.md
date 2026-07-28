# Plan: Products Sidebar Routing Fix

**Branch:** `fix/products-sidebar-routing`

---

## Problem

The sidebar `Products` parent entry and the `All Products` sub-item both resolve to `/products`. When there are no products, both show the "Start listing your products" getting-started CTA page. The user expects:

- **Products** (parent) → getting-started CTA page
- **All Products** (sub-item) → product table or simple empty rubric

---

## Files to change

### 1. `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx`

Add `url: "/products/getting-started"` to the parent `Products` nav item so it navigates there when clicked. Keep `All Products` at `"/products"`.

```ts
{
  title: "Products",
  icon: <PackageIcon />,
  url: "/products/getting-started",   // ← ADD THIS
  items: [
    { title: "All Products", url: "/products" },
    { title: "Find Products to Sell", url: "/products?view=find" },
    { title: "Add Product", url: "/products?view=add" },
    // ...
  ],
},
```

---

### 2. New file: `apps/admin/src/app/(app)/products/getting-started/page.tsx`

Extract the "Start listing your products" CTA section from `products/page.tsx` (currently the empty state rendered when `products.length === 0` and `view === "overview"`) into its own standalone page at `/products/getting-started`.

This page:
- Shows the hero: "Start listing your products" headline + subtext
- Has two CTA cards/buttons: "Find Products to Sell" and "Add Product"
- Links to `/products?view=find` and `/products?view=add`
- Is the destination when clicking the parent `Products` sidebar entry

---

### 3. `apps/admin/src/app/(app)/products/page.tsx`

Replace the current "Start listing your products" empty state (the block shown when `products.length === 0` and `view === "overview"`) with a **simple empty rubric**:

- Icon + "No products yet" heading
- "Create your first product to start building your storefront." subtext
- A single "Add Product" button linking to `?view=add`
- No hero section, no "Find Products" CTA

This keeps the page focused on the listing experience. The full getting-started flow is now at `/products/getting-started`.

---

## Verification

1. Navigate to `/products` ("All Products") — shows product table or simple "No products yet" rubric
2. Navigate to `/products/getting-started` or click parent "Products" — shows full CTA page
3. Empty state on `/products` has a single CTA to add a product, subtly pointing to the getting-started flow
