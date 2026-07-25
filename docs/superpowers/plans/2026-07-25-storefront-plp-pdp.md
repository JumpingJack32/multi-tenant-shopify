# Storefront PLP / PDP — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-25-storefront-plp-pdp.md`

---

## Step 1 — Catch-All Taxonomy Route

**File:** `apps/storefront/src/app/[tenant]/[...path]/page.tsx`

- Server component: extract `leafSlug` from `params.path[params.path.length - 1]`
- Lightweight `getCategoryBySlug(tenant, leafSlug)` call — `notFound()` if no match
- Pass `leafSlug` as `category` param to `fetchStorefrontProducts()`
- Render `<ProductListing>` client component with initial products + category slug

---

## Step 2 — ProductListing Component

**File:** `apps/storefront/src/components/storefront/product-listing.tsx`

- Client component receiving initial products + category slug
- Faceted filters sidebar (desktop) / Sheet (mobile): price range, size, color checkboxes
- Sort dropdown synced to `?sort=` via `useSearchParams()` + `useRouter().replace()` with `scroll: false`
- Filter state resets on category slug change (user navigates between taxonomy paths)
- "Load More" cursor-based pagination
- Empty state with link to all products

---

## Step 3 — PDP Upgrades

### Image Gallery

**File:** `apps/storefront/src/components/storefront/image-gallery.tsx`

- Thumbnail strip on left (desktop), swipeable dots on mobile
- Accepts `images` array + optional `activeIndex` from variant selection
- Main image updates when variant selection changes

### Variant Selector

**File:** `apps/storefront/src/components/storefront/variant-selector.tsx`

- Labelled option buttons (e.g. "Color: Black", "Size: M")
- Out-of-stock combinations disabled with strikethrough
- Auto-selects first valid variant on mount
- Exposes selected variant + quantity to parent

### ProductDetail integration

**File:** `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx`

- Replace static image grid with `<ImageGallery>`
- Replace raw variant mapping with `<VariantSelector>`
- Add breadcrumb: Home > Category > Product Name
- Add related products section at bottom

---

## Step 4 — Legacy Cleanup

**File:** `apps/storefront/next.config.ts`

- Add 301 redirects: `/shop/all` → `/products`, `/shop/:category` → `/products?category=:category`, `/shop/:category/:slug` → `/products/:slug`

Remove unused legacy components: `ProductGrid`, `ProductGallery`, `ProductInfo`, old `MobileStickyCta`

---

## Step 5 — Verify

```bash
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
```
