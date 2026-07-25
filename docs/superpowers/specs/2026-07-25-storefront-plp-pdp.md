# Storefront PLP / PDP — Navigation-Driven Product Pages

## Problem

The navigation menu links to `/women`, `/men`, `/women/coats-jackets`, `/bags`, etc. — editorial taxonomy paths. The storefront has working product pages at `/products/` and `/products/[slug]`, but no routes that match the nav taxonomy. Users clicking nav links hit 404s.

## Scope

Bridge the gap between the navigation taxonomy and actual product pages. Not a rebuild — consolidate the dual legacy/new systems.

---

## 1. Route Mapping — Catch-All

Single `apps/storefront/src/app/[tenant]/[...path]/page.tsx` (server component) handles all taxonomy paths. Explicit routes (`/products/`, `/cart/`, `/account/`) take priority via Next.js App Router precedence.

```tsx
export default async function TaxonomyCategoryPage({
  params,
}: {
  params: { tenant: string; path: string[] };
}) {
  const leafSlug = params.path[params.path.length - 1];
  const fullPath = params.path.join("/");
  // Lightweight category lookup — if no match, return notFound()
}
```

The `leafSlug` is passed as the `category` query param to `GET /api/v1/storefront/{tenant}/products?category={leafSlug}`.

Use `next.config.js` for legacy redirects (not physical files):

```js
async redirects() {
  return [
    { source: "/:tenant/shop/all", destination: "/:tenant/products", permanent: true },
    { source: "/:tenant/shop/:category", destination: "/:tenant/products?category=:category", permanent: true },
    { source: "/:tenant/shop/:category/:slug", destination: "/:tenant/products/:slug", permanent: true },
  ];
}
```

**SEO:** Canonical link tags on PDP pages point to `/[tenant]/products/[slug]` regardless of referring path.

---

## 2. PLP — Product Listing Component

`apps/storefront/src/components/storefront/product-listing.tsx` (client component)

- Reuses the existing `ProductCard` from `products/product-card.tsx`
- **Faceted filters sidebar** (desktop) / Sheet (mobile):
  - Category breadcrumb
  - Price range (min/max in cents)
- **Sort:** `?sort=price_asc|price_desc|newest|name` synced to URL via `useSearchParams()` + `useRouter().replace()` with `scroll: false`
- **Pagination:** "Load more" cursor-based button
- **Empty state:** "Nothing in this category yet" with link to all products
- **Category lookup:** if the leaf slug doesn't match any known category, render `notFound()`

---

## 3. PDP — Product Detail Refinements

Refine the existing `ProductDetail` component:

- **Image gallery** — thumbnail strip on left (desktop), swipeable on mobile. Update main image when variant selection changes.
- **Variant selector** — labelled option buttons (e.g. "Size: M", "Color: Black"). Disable out-of-stock combinations with strikethrough. Auto-select first valid variant on mount.
- **Quantity selector** — [-] 1 [+] before add to cart
- **Breadcrumb** — Home > Category > Product Name
- **Related products** — grid from same category, exclude current

---

## 4. Consolidation

| Route | Action |
|-------|--------|
| `/shop/all/` | 301 redirect via `next.config.js` |
| `/shop/[category]/` | 301 redirect via `next.config.js` |
| `/shop/[category]/[slug]` | 301 redirect to `/products/[slug]` |

---

## 5. Files Changed

| File | Change |
|------|--------|
| `apps/storefront/src/app/[tenant]/[...path]/page.tsx` | New: catch-all taxonomy route |
| `apps/storefront/src/components/storefront/product-listing.tsx` | New: shared PLP with filters, sort, load-more |
| `apps/storefront/src/components/storefront/image-gallery.tsx` | New: thumbnail strip + swipeable gallery |
| `apps/storefront/src/components/storefront/variant-selector.tsx` | New: labelled options, stock-aware, quantity |
| `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx` | Update: new gallery + variant selector + breadcrumb |
| `apps/storefront/next.config.ts` | Add legacy `/shop/*` redirects |
