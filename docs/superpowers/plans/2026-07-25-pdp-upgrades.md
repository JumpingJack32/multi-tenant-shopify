# PDP Upgrades — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-25-pdp-upgrades.md`

---

## Step 1 — ImageGallery

**File:** `apps/storefront/src/components/storefront/image-gallery.tsx`

- Desktop: thumbnail strip (left) + main image (right). Click thumbnail → swap main.
- Mobile: horizontal scroll with dot indicators (simple `overflow-x-auto` + snap, no external carousel lib)
- Fallback: SVG placeholder when `images` is empty
- Accepts `activeIndex` + `onIndexChange` for external variant sync

---

## Step 2 — VariantSelector

**File:** `apps/storefront/src/components/storefront/variant-selector.tsx`

- Group variants by option keys (`Color`, `Size`, etc.)
- Render labelled swatch rows
- Cross-check current selection matrix: disable option buttons where no matching in-stock variant exists
- Auto-select first valid variant on mount
- `onVariantChange` emits the selected variant (includes its `image_url` for gallery sync)
- Quantity selector: [-] 1 [+]

---

## Step 3 — ProductDetail Integration

**File:** `apps/storefront/src/app/[tenant]/products/[slug]/product-detail.tsx`

- Two-column layout: gallery left, info right
- Breadcrumb: Home > Category > Product Name
- Variant selector + quantity + add-to-cart
- Price updates on variant change
- Description in collapsible accordion
- Related products grid (same category, exclude current, limit 4)

---

## Step 4 — Verify

```bash
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
```
