# Storefront PLP & PDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare tenant product stub with a full luxury storefront: brand landing page, dynamic PLP, and high-converting PDP.

**Architecture:** Server components for data fetching (ProductGrid, routes), client components for interactivity (ProductCard, ProductGallery, ProductInfo, AddToCartButton). Zustand cart. Unsplash demo URLs for images (Cloudinary integration deferred).

**Tech Stack:** Next.js 16 App Router, Tailwind v4, `motion/react` (via `@repo/ui/components/motion`), Zustand, `@repo/tenant-orm`

## Global Constraints

- All new components go in `apps/storefront/src/components/storefront/`
- Tests live in `apps/storefront/src/components/storefront/__tests__/`
- Use `jsdom` + `react()` vitest config; `cleanup()` in `afterEach` for React tests
- Import `motion` and `AnimatePresence` from `@repo/ui/components/motion`
- ProductCard is `"use client"`; ProductGrid is a server component
- Fetch uses `NEXT_PUBLIC_API_URL` with 5s timeout and AbortController
- Demo image URLs: use `https://images.unsplash.com/photo-{id}?w={width}&h={height}&fit=crop&auto=format`
- Price is in cents (integer), display as pounds: `£{(price / 100).toFixed(2)}`

---

### Task 1: Data model — Add price, specs & images to Product

**Files:**

- Modify: `packages/tenant-orm/src/types.ts`
- Modify: `packages/tenant-orm/src/schemas/tenant.ts`
- Test: `packages/tenant-orm/src/__tests__/product-schema.test.ts`

- [ ] **Step 1: Add price, specs, images to Product type**

Edit `packages/tenant-orm/src/types.ts`. Add after `is_active: boolean;`:

```typescript
  price?: number | null;
  specs?: { label: string; value: string }[] | null;
  images?: string[] | null;
```

- [ ] **Step 2: Add specs and images to Zod schemas**

In `packages/tenant-orm/src/schemas/tenant.ts`:

- `ProductSchema`: add `price: z.number().int().nonnegative().nullable().optional(),`, `specs: z.array(z.object({ label: z.string(), value: z.string() })).nullable().optional(),`, `images: z.array(z.string()).nullable().optional(),`
- `ProductCreateSchema`: add same
- `ProductUpdateSchema`: add same

- [ ] **Step 3: Write and run schema test**

`packages/tenant-orm/src/__tests__/product-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ProductSchema } from "../schemas/tenant";

describe("ProductSchema", () => {
  it("accepts price, specs and images", () => {
    const result = ProductSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      tenant_id: "00000000-0000-0000-0000-000000000002",
      name: "Test",
      slug: "test",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      price: 3499,
      specs: [{ label: "MATERIAL", value: "Nylon" }],
      images: ["https://example.com/img.jpg"],
    });
    expect(result.price).toBe(3499);
    expect(result.specs).toEqual([{ label: "MATERIAL", value: "Nylon" }]);
    expect(result.images).toEqual(["https://example.com/img.jpg"]);
  });

  it("accepts null optional fields", () => {
    const result = ProductSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      tenant_id: "00000000-0000-0000-0000-000000000002",
      name: "Test",
      slug: "test",
      status: "published",
      weight_unit: "kg",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    expect(result.price).toBeUndefined();
    expect(result.specs).toBeUndefined();
    expect(result.images).toBeUndefined();
  });
});
```

Run: `pnpm --filter @repo/tenant-orm exec vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

---

### Task 2: Extend CartItem with name, price, image

**Files:**

- Modify: `apps/storefront/src/hooks/use-cart.ts`
- Modify: `apps/storefront/src/components/storefront/cart.tsx`
- Test: `apps/storefront/src/components/storefront/__tests__/cart.test.tsx`

- [ ] **Step 1: Update CartItem interface**

In `use-cart.ts`, change `CartItem`:

```typescript
interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}
```

Update `addItem` signature:

```typescript
addItem: (product_id: string, name: string, price: number, image?: string, quantity?: number) => void;
```

Update implementation to accept new params.

- [ ] **Step 2: Update Cart component**

Replace `apps/storefront/src/components/storefront/cart.tsx` to display name, price, total.

- [ ] **Step 3: Write and run cart tests**

Write `cart.test.tsx` testing empty state, items with name/price, total calculation.

- [ ] **Step 4: Commit**

---

### Task 3: Rewrite ProductCard with ghost card

**Files:**

- Modify: `apps/storefront/src/components/storefront/product-card.tsx`
- Modify: `apps/storefront/src/components/storefront/__tests__/product-card.test.tsx`

- [ ] **Step 1: Write new ProductCard**

Client component. Props: `{ product: Product; categorySlug: string }`.

- 4:5 aspect image container, dark bg
- Primary image visible, secondary on hover with 300ms cross-fade via `AnimatePresence`
- On click → `router.push(/${tenant}/shop/${categorySlug}/${product.slug})`
- Name + price below image
- Missing image → placeholder with product name text
- `line-clamp-2` on name if long

- [ ] **Step 2: Rewrite test**

Update test for new interface: render with mock product, test name+price display, test image placeholder.

- [ ] **Step 3: Commit**

---

### Task 4: ProductGrid server component

**Files:**

- Create: `apps/storefront/src/components/storefront/product-grid.tsx`
- Test: `apps/storefront/src/components/storefront/__tests__/product-grid.test.tsx`

- [ ] **Step 1: Create ProductGrid**

Server component. Props: `{ tenantSlug: string; categorySlug?: string }`.
Fetches `GET /api/v1/public/products/{tenantSlug}` with 5s timeout. Renders grid of ProductCards.
Empty state: centered "No products available yet." with home link.

- [ ] **Step 2: Write tests**

Mock `fetch`, test render with products, empty state.

- [ ] **Step 3: Commit**

---

### Task 5: PLP routes — shop/all and shop/[category]

**Files:**

- Create: `apps/storefront/src/app/[tenant]/shop/all/page.tsx`
- Modify: `apps/storefront/src/app/[tenant]/shop/[category]/page.tsx`

- [ ] **Step 1: Create shop/all page**

Server component. Renders `ProductGrid` with `tenantSlug={tenant}`.

- [ ] **Step 2: Replace category placeholder**

Replace `apps/storefront/src/app/[tenant]/shop/[category]/page.tsx` with ProductGrid.

- [ ] **Step 3: Commit**

---

### Task 6: ProductGallery client component

**Files:**

- Create: `apps/storefront/src/components/storefront/product-gallery.tsx`
- Test: `apps/storefront/src/components/storefront/__tests__/product-gallery.test.tsx`

- [ ] **Step 1: Create ProductGallery**

Client component. Props: `{ images: string[]; name: string }`.

- Hero image (16:9) with cross-fade on hover
- 4-5 detail images stacked below (4:5)
- Missing images → placeholder

- [ ] **Step 2: Write tests**

- [ ] **Step 3: Commit**

---

### Task 7: ProductInfo + AddToCartButton

**Files:**

- Create: `apps/storefront/src/components/storefront/product-info.tsx`
- Create: `apps/storefront/src/components/storefront/add-to-cart-button.tsx`
- Test: `apps/storefront/src/components/storefront/__tests__/product-info.test.tsx`
- Test: `apps/storefront/src/components/storefront/__tests__/add-to-cart-button.test.tsx`

- [ ] **Step 1: Create AddToCartButton**

Client. Props: `{ product: Product }`. Calls `useCart().addItem()`. Shows "Added!" confirmation briefly then resets.

- [ ] **Step 2: Create ProductInfo**

Client. Props: `{ product: Product }`. Sticky sidebar with:

1. Product name (2xl)
2. Static star rating
3. Price (large)
4. Divider
5. Size selector (coming soon)
6. AddToCartButton
7. Specifications table (if specs exist)
8. Risk relievers (free shipping, 30-day returns, secure checkout)

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

### Task 8: PDP route — [category]/[slug]

**Files:**

- Create: `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx`

- [ ] **Step 1: Create PDP page**

Server component. Fetches all products, filters by slug. Renders two-column layout:

- Left: ProductGallery
- Right: ProductInfo (sticky sidebar)

Mobile: single column, sticky bottom CTA bar.

Not-found → 404 message with link back to shop.

- [ ] **Step 2: Commit**

---

### Task 9: Brand landing page at /[tenant] + nav links

**Files:**

- Modify: `apps/storefront/src/app/[tenant]/page.tsx`
- Modify: `apps/storefront/src/app/page.tsx`

- [ ] **Step 1: Replace tenant landing page**

Replace `[tenant]/page.tsx` with brand landing page (editorial hero, about section, link to shop).

- [ ] **Step 2: Update nav links in page.tsx**

Change `/cats-and-dogs/shop/cats` → `/cats-and-dogs/shop/all` and `/cats-and-dogs/shop/dogs` → `/cats-and-dogs/shop/rucksacks`.

- [ ] **Step 3: Commit**

---

### Task 10: Verify everything works

- [ ] **Run all tests**

```bash
doppler run -- pnpm turbo run test
```

Expected: All PASS

- [ ] **Final commit**

```bash
git commit -m "feat(storefront): PLP, PDP, brand landing page"
```
