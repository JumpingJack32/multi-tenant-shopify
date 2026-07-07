# Storefront — Product Listing Page & Product Detail Page

## Overview

Replace the bare `[tenant]/page.tsx` product list stub with a full luxury streetwear shopping experience: a cinematic brand landing page at `/[tenant]`, a dynamic product listing page (PLP) at `/[tenant]/shop/all` and `/[tenant]/shop/[category]`, and a high-converting product detail page (PDP) at `/[tenant]/shop/[category]/[slug]`.

Target audience: Gen-Z. Brand aesthetic: minimalist techwear / luxury streetwear. Products: rucksacks, backpacks, boots, t-shirts, jackets, tech gadgets.

## Routing

```code
/[tenant]                                → Brand landing page (editorial)
/[tenant]/shop/all                        → Full catalog PLP
/[tenant]/shop/[category]                 → Category PLP (rucksacks, gadgets, etc.)
/[tenant]/shop/[category]/[slug]          → PDP
```

- `[tenant]` resolves to a tenant slug (e.g., `cats-and-dogs` → Amoa & Agou)
- `[category]` is cosmetic for now — all routes (`all`, `rucksacks`, `gadgets`) render the same product set. Structured so backend category filtering can slot in later.
- `[slug]` maps to `Product.slug`

The landing page nav links (`/cats-and-dogs/shop/cats`, `/cats-and-dogs/shop/dogs`) will be updated to point to `/cats-and-dogs/shop/all` and `/cats-and-dogs/shop/rucksacks` respectively.

## Components

### New Files

|File                                          |Purpose                                                |
|----------------------------------------------|-------------------------------------------------------|
|`app/[tenant]/page.tsx`                       |Brand landing page — replace existing stub             |
|`app/[tenant]/shop/all/page.tsx`              |PLP — full catalog (re-uses ProductGrid)               |
|`app/[tenant]/shop/[category]/page.tsx`       |PLP — replace existing placeholder, re-uses ProductGrid|
|`app/[tenant]/shop/[category]/[slug]/page.tsx`|PDP — product detail                                   |
|`components/storefront/product-grid.tsx`      |Server component — fetches products, renders grid      |
|`components/storefront/product-card.tsx`      |**Rewrite** — ghost card with cross-fade hover         |
|`components/storefront/product-gallery.tsx`   |Client — image display with hover cross-fade           |
|`components/storefront/product-info.tsx`      |Client — PDP sidebar (info, size selector, CTA)        |
|`components/storefront/add-to-cart-button.tsx`|Client — integrates with useCart                       |

### Modified Files

|File                                         |Change                                                        |
|---------------------------------------------|--------------------------------------------------------------|
| `app/[tenant]/shop/[category]/page.tsx`     | Replace "coming soon" placeholder with ProductGrid           |
| `app/page.tsx`                              | Update nav link hrefs to use `/cats-and-dogs/shop/all` and   `/cats-and-dogs/shop/rucksacks` |
| `hooks/use-cart.ts`                         | Extend CartItem interface to include `name`, `price`, `image`|
| `components/storefront/cart.tsx`            | Update cart display to show product name/price/image         |
| `packages/tenant-orm/src/types.ts`          | Add optional `specs` field to Product type                   |
| `packages/tenant-orm/src/schemas/tenant.ts` | Add optional `specs` to Product zod schemas                  |

### Removed

- `app/[tenant]/page.tsx` (stub) — replaced by new brand landing page
- `components/storefront/product-card.tsx` (old) — replaced by rewrite

## PLP — Product Listing Page

### Route: `/[tenant]/shop/[category]/page.tsx`

Server component. Fetches `GET /api/v1/public/products/{tenant_slug}` with a 5s timeout. On error or empty, renders "No products available yet." Falls back gracefully without crashing.

### ProductGrid

Server component. Props: `tenantSlug: string`. Fetches products, passes to client `ProductCard` components.

### ProductCard (rewrite)

Client component (`"use client"`). Props: `product: Product`, `categorySlug: string`.

**Desktop:**

- Dark background, no visible card border
- `aspect-[4/5]` container with image
- Two images: primary (static) and secondary (hover). Uses `<Image>` from `next/image` with cross-fade via `motion` `AnimatePresence`
- Below image: product name in bold, price in monospace — e.g.:
  
```code
  CYBERNETIC RUCKSACK v2.1
  £340
  ```

- On hover: 300ms cross-fade from primary to secondary image. Smooth opacity transition.
- Click → `router.push(/${tenant}/shop/${category}/${product.slug})`

**Mobile:**

- Single column, same ghost card layout
- No hover (tap navigates directly to PDP)
- Full-width images at 4:5 ratio

**Loading state:** Skeleton pulse — 6 placeholder cards with gray animated blocks matching the 4:5 aspect ratio.

**Empty state:** Centered message: "No products available yet." with a link back to home.

## PDP — Product Detail Page

### Route: `/[tenant]/shop/[category]/[slug]/page.tsx`

Server component. Fetches product by slug from the backend list (no single-product endpoint yet — filters the products array client-side after server fetch). On not-found, renders a 404-style message with link back to shop.

### Desktop Layout: Two-Column Split

**Left — ProductGallery (client component):**

- Oversized hero image (16:9 aspect, full-width)
- 4-5 detail images stacked below (4:5 aspect)
- Images sourced from Unsplash demo URLs for POC
- Video slot planned but stubbed (conditional render if `videoUrl` exists on product)

**Right — ProductInfo (client, sticky sidebar):**

- `sticky top-24 self-start` (below header)
- Contents in order:
  1. Product name (large, bold, 2xl)
  2. Star rating display — static ★★★★★ (142) for now
  3. Price — £340, prominent, large
  4. `---` divider
  5. "SELECT SIZE" label + grid: [S] [M] [L] [XL] — all disabled, rendered as "coming soon" badges. Single "ONE SIZE" chip selected by default so the CTA works.
  6. **AddToCartButton** — full-width, high-contrast (`bg-primary text-primary-foreground`), large. Integrates with `useCart`. On click: adds product with `{ product_id, name, price, image }`. Button shows brief "Added!" confirmation then resets.
  7. **Specifications** — rendered from `product.specs` (JSON array of `{ label, value }`). Rendered as a clean two-column list:

```code
MATERIAL     Cordura® Ballistic Nylon
CLOSURE      Magnetic Fidlock® Buckles
LAPTOP FIT   16" Integrated Chamber
```

If `specs` is null/empty, section hides entirely.

 8. **Risk relievers** — 3 small icons + text:

```code
[truck] FREE SHIPPING    [rotate] 30-DAY RETURNS    [lock] SECURE CHECKOUT
     ```

### Mobile Layout: Single Column + Sticky CTA

- Single column stack: hero → product info → specs → detail images
- **Sticky bottom CTA bar** — `fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border p-3 flex items-center justify-between`
  - Left: product name (truncated) + price
  - Right: "ADD TO CART" button
- The bar appears when scrolling up and hides when scrolling down (scroll-direction detection via a `useEffect`). This prevents it from blocking content during downward scroll while keeping it accessible.
- Size selector is inline above the sticky bar, not in the bar itself.

## Data Model Changes

### Product type (`packages/tenant-orm/src/types.ts`)

Add optional field:

```typescript
export interface Product {
  // ... existing fields
  specs?: { label: string; value: string }[] | null;
  images?: string[] | null;
}
```

### CartItem (`hooks/use-cart.ts`)

Extend:

```ts
interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}
```

## Theme & Aesthetic

- Dark background (`bg-black` or near-black) for the PLP. The existing CSS variables support this via the `.dark` theme.
- The brand landing page at `/[tenant]` uses the light/dark theme from globals.css. The PLP and PDP deliberately use a dark canvas to make product images pop.
- Typography: existing Inter font for body. Monospace (`font-mono`) for price and tech metadata. These are already configured in `@theme inline` in globals.css.
- Motion: cross-fade transitions use `motion` from `@repo/ui/components/motion` (already available).

## Edge Cases

| Case                   | Handling                                                                                               |
|------------------------|--------------------------------------------------------------------------------------------------------|
| Backend unreachable    | PLP shows "No products available yet." PDP shows "Product not found" with back link (since fetch returns empty list, slug won't match) |
| Product slug not found | PDP shows 404-style message, link back to shop                                                         |
| Empty catalog          | PLP shows centered message, no broken UI                                                               |
| Missing images         | Show a muted placeholder box with the product name                                                     |
| Missing specs          | Spec section hidden entirely                                                                           |
| Very long product name | Truncate with `line-clamp-2` on cards. Full name on PDP.                                               |
| Network timeout        | 5s abort on fetch, graceful fallback to empty                                                          |

## Testing

- **ProductGrid:** Test that it renders products from mocked fetch, shows empty state, shows error state
- **ProductCard (rewrite):** Test render with name+price, hover triggers cross-fade, click navigates to PDP
- **ProductInfo:** Test render with all sections, render without specs, size selector interaction
- **AddToCartButton:** Test click adds to cart, shows confirmation, handles double-click
- **PDP page:** Test renders product info, handles missing product, renders specs if present
- **Mobile sticky CTA:** Test visibility toggle on scroll direction

## Non-Goals (Future Iterations)

- Backend category filtering — all "category" routes show the same product set
- Variant/size CRUD — size selector is cosmetic/disabled until variants exist
- User reviews/ratings — star rating is static placeholder
- Video assets — video slot is planned but stubbed
- Gender-based filtering / male/female split
- Cloudinary integration — using demo URLs for POC
- Search/filter/sort on PLP
- Structured data / Schema.org markup
