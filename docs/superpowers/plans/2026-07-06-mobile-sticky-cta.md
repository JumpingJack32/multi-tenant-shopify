# Mobile Sticky CTA Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed-bottom sticky CTA bar to the PDP that appears on mobile/tablet after scrolling past the inline Add to Cart button.

**Architecture:** A new `MobileStickyCta` client component uses `IntersectionObserver` to detect when the inline AddToCartButton (identified by `#pdp-inline-cta` id) scrolls out of view, then animates in a fixed-bottom bar displaying price + AddToCartButton. ProductInfo gets an id on its CTA wrapper. The PDP server component renders MobileStickyCta after the grid.

**Tech Stack:** React 19, Next.js 16 (server/client components), Base UI (via `@repo/ui/base-ui`), motion (Framer Motion v12 re-exported via `@repo/ui/components/motion`), Tailwind v4, vitest + jsdom + @testing-library/react

## Global Constraints

- Import `motion` from `@repo/ui/components/motion`, never from `motion/react` directly
- Price formatting: `£{(n / 100).toFixed(2)}`
- Tailwind v4 arbitrary value syntax: `pb-[env(safe-area-inset-bottom)]`
- Test pattern: vitest + jsdom + @testing-library/react, `cleanup()` in `afterEach`
- `"use client"` directive on client components

---

### Task 1: Create MobileStickyCta component with tests

**Files:**
- Create: `apps/storefront/src/components/storefront/mobile-sticky-cta.tsx`
- Create: `apps/storefront/src/components/storefront/__tests__/mobile-sticky-cta.test.tsx`
- Modify: `apps/storefront/src/components/storefront/product-info.tsx` (lines 47-49 — add id to CTA wrapper)

**Interfaces:**
- Produces: `MobileStickyCta({ product }: { product: Product })` — renders fixed-bottom bar
- Consumes: `#pdp-inline-cta` DOM element rendered by ProductInfo
- Uses: `AddToCartButton` component (imported from `./add-to-cart-button`)
- Uses: `motion` from `@repo/ui/components/motion`

- [ ] **Step 1: Write the failing test for MobileStickyCta**

```tsx
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MobileStickyCta } from "../mobile-sticky-cta";
import { useCart } from "@/hooks/use-cart";
import type { Product } from "@repo/tenant-orm/types";

afterEach(() => {
  cleanup();
  useCart.getState().clear();
});

const baseProduct: Product = {
  id: "prod-1",
  tenant_id: "tenant-1",
  name: "Test Product",
  slug: "test-product",
  description: "A great product",
  sku: null,
  status: "published",
  weight: null,
  weight_unit: "g",
  is_active: true,
  price: 4999,
  specs: null,
  images: ["/image1.jpg"],
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

// Stub IntersectionObserver so component mounts without error
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })));
});

describe("MobileStickyCta", () => {
  it("renders formatted price", () => {
    render(<MobileStickyCta product={baseProduct} />);
    // Price is displayed when the component detects the inline CTA is out of view.
    // The component always mounts; visibility is toggled by state.
    expect(screen.getByText("£49.99")).toBeDefined();
  });

  it("renders AddToCartButton", () => {
    render(<MobileStickyCta product={baseProduct} />);
    expect(screen.getByText("ADD TO CART")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run --project storefront -t "MobileStickyCta"`
Expected: FAIL with "Cannot find module '../mobile-sticky-cta'"

- [ ] **Step 3: Write minimal MobileStickyCta implementation**

```tsx
"use client";

import { useEffect, useState } from "react";
import { motion } from "@repo/ui/components/motion";
import { AddToCartButton } from "./add-to-cart-button";
import type { Product } from "@repo/tenant-orm/types";

interface MobileStickyCtaProps {
  product: Product;
}

export function MobileStickyCta({ product }: MobileStickyCtaProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById("pdp-inline-cta");
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lg:hidden">
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border"
        initial={{ y: 80 }}
        animate={{ y: visible ? 0 : 80 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div
          className="min-h-14 px-4 flex items-center justify-between gap-4"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {product.price != null && (
            <span className="text-sm font-text text-foreground whitespace-nowrap">
              £{(product.price / 100).toFixed(2)}
            </span>
          )}
          <div className="w-auto shrink-0">
            <AddToCartButton product={product} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run --project storefront -t "MobileStickyCta"`
Expected: PASS

- [ ] **Step 5: Add id to ProductInfo's CTA wrapper**

In `apps/storefront/src/components/storefront/product-info.tsx`, change line 47 from:
```tsx
      <div className="mt-6">
```
to:
```tsx
      <div className="mt-6" id="pdp-inline-cta">
```

- [ ] **Step 6: Run existing tests to verify no regressions**

Run: `pnpm vitest run --project storefront`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/components/storefront/mobile-sticky-cta.tsx apps/storefront/src/components/storefront/__tests__/mobile-sticky-cta.test.tsx apps/storefront/src/components/storefront/product-info.tsx
git commit -m "feat(storefront): add MobileStickyCta component with scroll-triggered visibility"
```

---

### Task 2: Wire MobileStickyCta into PDP page

**Files:**
- Modify: `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx`

**Interfaces:**
- Consumes: `MobileStickyCta` from `@/components/storefront/mobile-sticky-cta`
- Consumes: `Product` type from `@repo/tenant-orm/types`

- [ ] **Step 1: Write the test (check component imports and renders)**

Add to `apps/storefront/src/components/storefront/__tests__/mobile-sticky-cta.test.tsx`:

```tsx
it("renders nothing when product is missing price", () => {
  const noPrice = { ...baseProduct, price: null };
  const { container } = render(<MobileStickyCta product={noPrice} />);
  // Price element should not render; button should still render
  expect(screen.getByText("ADD TO CART")).toBeDefined();
  expect(container.querySelector("span")).toBeNull();
});
```

- [ ] **Step 2: Run test**

Run: `pnpm vitest run --project storefront -t "MobileStickyCta"`
Expected: PASS

- [ ] **Step 3: Import and render MobileStickyCta in page.tsx**

In `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx`, add import after the existing ProductInfo import:
```tsx
import { MobileStickyCta } from "@/components/storefront/mobile-sticky-cta";
```

Add MobileStickyCta after the closing `</div>` of the grid, still inside the `<main>`:
```tsx
      </div>
      <MobileStickyCta product={product} />
    </main>
```

The full return block should look like:
```tsx
  return (
    <main className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <Link
          href={`/${tenant}/shop/${category}`}
          className="inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to{" "}
          {category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto px-4 pb-8">
        <div>
          <ProductGallery images={product.images ?? []} name={product.name} />
        </div>
        <div>
          <ProductInfo product={product} />
        </div>
      </div>
      <MobileStickyCta product={product} />
    </main>
  );
```

- [ ] **Step 4: Run all tests**

Run: `pnpm vitest run`
Expected: all 127+ tests PASS

- [ ] **Step 5: TypeScript check**

Run: `pnpm --filter @repo/storefront exec tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/app/\[tenant\]/shop/\[category\]/\[slug\]/page.tsx apps/storefront/src/components/storefront/__tests__/mobile-sticky-cta.test.tsx
git commit -m "feat(storefront): wire MobileStickyCta into PDP page"
```
