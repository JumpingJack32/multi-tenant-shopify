# PDP Upgrades — Image Gallery, Variant Selector, Product Detail Integration

**Spec:** Step 3 of `docs/superpowers/specs/2026-07-25-storefront-plp-pdp.md`

---

## 1. Image Gallery

**File:** `apps/storefront/src/components/storefront/image-gallery.tsx`

Desktop: thumbnail strip on the left, main image on the right. Clicking a thumbnail swaps the main image. Thumbnails highlight on selection.

Mobile: swipeable carousel with dot indicators. Uses `embla-carousel-react` or simple touch-state tracking.

Accepts an optional `activeIndex` prop — external callers (variant selector) can set which image is shown.

```tsx
interface ImageGalleryProps {
  images: Array<{ url: string; alt_text?: string | null }>;
  activeIndex?: number;
  onIndexChange?: (index: number) => void;
}
```

---

## 2. Variant Selector

**File:** `apps/storefront/src/components/storefront/variant-selector.tsx`

Receives the product's variants and renders labelled option buttons grouped by option key:

```
COLOR:    [Black]  Camel  Navy
SIZE:     S  [M]  L  XL
```

Out-of-stock combinations disabled with `opacity-50 line-through`. On mount, auto-selects the first in-stock variant.

```tsx
interface VariantSelectorProps {
  variants: Array<{
    id: string;
    sku: string;
    price: number;
    compare_at_price?: number | null;
    is_active: boolean;
    in_stock: boolean;
    options: Record<string, string>;
  }>;
  onVariantChange: (variant: { id: string; price: number; compare_at_price?: number | null; in_stock: boolean }) => void;
  selectedVariantId?: string;
}
```

Exposes selected variant + quantity up to the parent via `onVariantChange`.

---

## 3. ProductDetail Integration

**File:** `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx`

Replace current static content with:

- **Breadcrumb:** Home > Category > Product Name (category slug from `product.category_slug`)
- **Layout:** Two-column — gallery on left, product info on right
- **Product info column:**
  - Product name, price, SKU
  - `<VariantSelector>` — on change, updates price display + gallery image index
  - Quantity selector ([-] 1 [+])
  - Add to cart button (existing `AddToCartVariantButton`)
  - In-stock / shipping note
  - Description (collapsible accordion)
- **Related products:** grid of products from same category, exclude current, limit 4

---

## 4. Files Changed

| File | Change |
|------|--------|
| `apps/storefront/src/components/storefront/image-gallery.tsx` | New: thumbnail strip + mobile swipe |
| `apps/storefront/src/components/storefront/variant-selector.tsx` | New: labelled options + stock awareness |
| `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx` | Rewrite: integrate gallery, variant selector, breadcrumb, related |
