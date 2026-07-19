# Storefront — Product Listing Page & Product Detail Page (Revised)

> **Status:** Draft

---

## 1. Value

Replace the bare `[tenant]/page.tsx` product list stub with a full luxury streetwear shopping experience: a cinematic brand landing page at `/[tenant]`, a dynamic product listing page (PLP) at `/[tenant]/shop/all` and `/[tenant]/shop/[category]`, and a high-converting product detail page (PDP) at `/[tenant]/shop/[category]/[slug]`.

Target audience: Gen-Z. Brand aesthetic: minimalist techwear / luxury streetwear. Products: rucksacks, backpacks, boots, t-shirts, jackets, tech gadgets.

---

## 2. Routing

```
/[tenant]                                → Brand landing page (editorial)
/[tenant]/shop/all                        → Full catalog PLP
/[tenant]/shop/[category]                 → Category PLP
/[tenant]/shop/[category]/[slug]          → PDP
```

- `[tenant]` resolves to a tenant slug (e.g., `cats-and-dogs` → tenant lookup)
- `[category]` is cosmetic — all routes render the same product set. Structured so backend category filtering can slot in later.
- `[slug]` maps to `Product.slug`
- **All pages must `await` the `params` Promise in Next.js 16.2.9** — synchronous access will throw at runtime.

---

## 3. Backend Data Model — `specs` Field

### Model change (`src/orm/models/product.py`)

Add a `specs` JSON column to `Product`:

```python
specs: Optional[dict[str, Any]] = Field(
    default=None,
    sa_column=Column(JSON, nullable=True, default=None,
                     comment="Structured product specs as JSON array of {label, value} objects"),
)
```

### Schema changes (`src/orm/schemas/product.py`)

```python
# In ProductResponse:
specs: Optional[list[dict[str, str]]] = None

# In ProductCreate / ProductUpdate:
specs: Optional[list[dict[str, str]]] = None
```

### Schema changes (`src/orm/schemas/storefront.py`)

```python
# In StorefrontProductResponse:
specs: Optional[list[dict[str, str]]] = None
```

### Seed data update

```python
# In seed script, add to product entries:
"specs": [
    {"label": "MATERIAL", "value": "Cordura® Ballistic Nylon"},
    {"label": "CLOSURE", "value": "Magnetic Fidlock® Buckles"},
    {"label": "LAPTOP FIT", "value": "16\" Integrated Chamber"},
],
```

### Migration

Generate via Alembic after model change:

```bash
cd services/backend-api && alembic revision --autogenerate -m "add product specs field"
```

---

## 4. Storefront API Integration

The storefront router at `/api/v1/storefront/` already provides everything needed with `CurrencyAwareRoute` for automatic price conversion:

| Endpoint                                                                      | Use                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET /api/v1/storefront/{tenant_slug}/products?page=1&page_size=20&category=` | PLP — paginated, currency-converted, filterable        |
| `GET /api/v1/storefront/{tenant_slug}/products/{product_slug}`                | PDP — single product with all variant/image/price data |

### Cache Strategy

Both endpoints should use Next.js `fetch` with tag-based revalidation:

```typescript
// PLP fetch (server component)
const products = await fetch(
  `${apiUrl}/api/v1/storefront/${tenantSlug}/products?page=1&page_size=50`,
  { next: { tags: [`storefront-products-${tenantSlug}`], revalidate: 60 } },
);

// PDP fetch (server component)
const product = await fetch(
  `${apiUrl}/api/v1/storefront/${tenantSlug}/products/${productSlug}`,
  {
    next: {
      tags: [`storefront-product-${tenantSlug}-${productSlug}`],
      revalidate: 60,
    },
  },
);
```

This gives 60s stale-while-revalidate with manual purge capability via `revalidateTag()` when products are updated in admin.

---

## 5. Components

### New Files

| File                                           | Purpose                                                 |
| ---------------------------------------------- | ------------------------------------------------------- |
| `app/[tenant]/page.tsx`                        | Brand landing page — replace existing stub              |
| `app/[tenant]/shop/all/page.tsx`               | PLP — full catalog (re-uses ProductGrid)                |
| `app/[tenant]/shop/[category]/page.tsx`        | PLP — replace existing placeholder, re-uses ProductGrid |
| `app/[tenant]/shop/[category]/[slug]/page.tsx` | PDP — product detail                                    |
| `components/storefront/product-grid.tsx`       | Server component — fetches products, renders grid       |
| `components/storefront/product-card.tsx`       | **Rewrite** — ghost card with cross-fade hover          |
| `components/storefront/product-gallery.tsx`    | Client — image display with hover cross-fade            |
| `components/storefront/product-info.tsx`       | Client — PDP sidebar (info, size selector, CTA)         |
| `components/storefront/add-to-cart-button.tsx` | Client — integrates with useCart                        |

### Modified Files

| File                                                 | Change                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `app/[tenant]/shop/[category]/page.tsx`              | Replace placeholder with ProductGrid, `await params`            |
| `app/page.tsx`                                       | Update nav link hrefs to use `/shop/all` and `/shop/rucksacks`  |
| `hooks/use-cart.ts`                                  | Extend `CartItem` interface to include `name`, `price`, `image` |
| `components/storefront/cart.tsx`                     | Update cart display to show product name/price/image            |
| `packages/tenant-orm/src/types.ts`                   | Add optional `specs` field to Product type                      |
| `services/backend-api/src/orm/models/product.py`     | Add `specs` JSON column                                         |
| `services/backend-api/src/orm/schemas/product.py`    | Add `specs` to create/update/response schemas                   |
| `services/backend-api/src/orm/schemas/storefront.py` | Add `specs` to StorefrontProductResponse                        |

---

## 6. PLP — Product Listing Page

### Route Example: `app/[tenant]/shop/[category]/page.tsx`

```typescript
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ tenant: string; category: string }>;
}

export default async function CategoryPage({ params }: PageProps) {
  const { tenant, category } = await params;
  // fetch + render ProductGrid
}
```

Server component. Fetches `GET /api/v1/storefront/{tenant}/products?category={category}` with tag-based caching. On error or empty, renders "No products available yet."

### ProductGrid

Server component. Props: `tenantSlug: string`, `categorySlug?: string`. Fetches products, passes to client `ProductCard` components.

### ProductCard (rewrite)

Client component (`"use client"`). Props: `product: Product`, `categorySlug: string`.

**Desktop:**

- Dark background, no visible card border
- `aspect-[4/5]` container with image
- Two images: primary (static) and secondary (hover). Uses `<Image>` from `next/image` with cross-fade via `motion` `AnimatePresence`
- Below image: product name in bold, price in monospace — e.g.:
  ```
  CYBERNETIC RUCKSACK v2.1
  £340
  ```
- On hover: 300ms cross-fade from primary to secondary image
- Click → `router.push(/${tenant}/shop/${category}/${product.slug})`

**Mobile:**

- Single column, same ghost card layout
- No hover (tap navigates directly to PDP)
- Full-width images at 4:5 ratio

**Loading state:** Skeleton pulse — 6 placeholder cards with gray animated blocks matching 4:5 aspect ratio.

**Empty state:** Centered "No products available yet." with link back to home.

---

## 7. PDP — Product Detail Page

### Route Example: `app/[tenant]/shop/[category]/[slug]/page.tsx`

```typescript
interface PageProps {
  params: Promise<{ tenant: string; category: string; slug: string }>;
}

export default async function ProductPage({ params }: PageProps) {
  const { tenant, slug } = await params;
  // fetch single product + render PDP
}
```

Server component. Fetches `GET /api/v1/storefront/{tenant}/products/{slug}` with tag-based caching.

### Desktop Layout: Two-Column Split

**Left — ProductGallery (client component):**

- Oversized hero image (16:9 aspect, full-width)
- 4-5 detail images stacked below (4:5 aspect)
- Images sourced from Unsplash demo URLs for POC
- Video slot planned but stubbed

**Right — ProductInfo (client, sticky sidebar):**

- `sticky top-24 self-start` (below header)
- Contents in order:
  1. Product name (large, bold, 2xl)
  2. Star rating — static ★★★★★ (142) for now
  3. Price — £340, prominent
  4. Divider
  5. Size selector — [S] [M] [L] [XL] disabled/coming-soon. "ONE SIZE" selected by default
  6. **AddToCartButton** — full-width, `bg-primary text-primary-foreground`. Integrates with `useCart`
  7. **Specifications** — rendered from `product.specs` as two-column list. Hides if null/empty
  8. **Risk relievers** — 3 icons: Free Shipping, 30-Day Returns, Secure Checkout

### Mobile Layout: Single Column + Sticky CTA

- Single column stack: hero → product info → specs → detail images
- **MobileStickyCta** — reuses existing component pattern (`fixed bottom-0`, scroll-direction detection)

---

## 8. CartItem Extensions

### `hooks/use-cart.ts`

```typescript
interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
}
```

The `useCart` hook's `addItem` function must accept these fields. The PDP's `AddToCartButton` passes them on click. The cart display in `cart.tsx` uses `name`, `price`, and `image` to render line items.

### `packages/tenant-orm/src/types.ts`

```typescript
export interface Product {
  // ... existing fields
  specs?: { label: string; value: string }[] | null;
}
```

---

## 9. Edge Cases

| Case                      | Handling                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| Backend unreachable       | PLP: "No products available yet." PDP: "Product not found" with back link                       |
| Product slug not found    | PDP: 404-style message, link back to shop                                                       |
| Empty catalog             | PLP: centered message, no broken UI                                                             |
| Missing images            | Muted placeholder box with product name                                                         |
| Missing specs             | Spec section hidden entirely                                                                    |
| Very long product name    | `line-clamp-2` on cards. Full name on PDP                                                       |
| Network timeout           | 5s abort on fetch, graceful fallback                                                            |
| `params` not yet resolved | All pages `await params` — no synchronous access                                                |
| Currency conversion       | Handled by backend `CurrencyAwareRoute` — frontend renders `display_price` / `display_currency` |

---

## 10. Risks & Mitigations

| Risk                                                    | Mitigation                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Next.js 16 `params` is a Promise                        | All pages/layouts `await params` before accessing `.tenant`, `.category`, `.slug` |
| `specs` migration conflicts with existing data          | New column is nullable — no backfill needed                                       |
| Storefront API returns paginated — frontend expects all | Pass large `page_size=50` for now; add client-side pagination in future iteration |
| Cache staleness on product update                       | Tag-based revalidation — admin product save triggers `revalidateTag()`            |
| CartItem type mismatch between stores                   | Shared `CartItem` interface in `@repo/tenant-orm` types — single source of truth  |

---

## 11. Files Changed

| File                                                               | Change                                            |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| `apps/storefront/src/app/[tenant]/page.tsx`                        | **Rewrite** — brand landing page                  |
| `apps/storefront/src/app/[tenant]/shop/all/page.tsx`               | **New** — full catalog PLP, `await params`        |
| `apps/storefront/src/app/[tenant]/shop/[category]/page.tsx`        | **Rewrite** — replace placeholder, `await params` |
| `apps/storefront/src/app/[tenant]/shop/[category]/[slug]/page.tsx` | **New** — PDP, `await params`                     |
| `apps/storefront/src/components/storefront/product-grid.tsx`       | **New** — server component                        |
| `apps/storefront/src/components/storefront/product-card.tsx`       | **Rewrite** — ghost card, cross-fade              |
| `apps/storefront/src/components/storefront/product-gallery.tsx`    | **New** — client image gallery                    |
| `apps/storefront/src/components/storefront/product-info.tsx`       | **New** — PDP sidebar                             |
| `apps/storefront/src/components/storefront/add-to-cart-button.tsx` | **New** — cart integration                        |
| `apps/storefront/src/hooks/use-cart.ts`                            | Extend `CartItem` with `name`, `price`, `image`   |
| `apps/storefront/src/app/page.tsx`                                 | Update nav link hrefs                             |
| `packages/tenant-orm/src/types.ts`                                 | Add `specs` to Product type                       |
| `services/backend-api/src/orm/models/product.py`                   | Add `specs` JSON column                           |
| `services/backend-api/src/orm/schemas/product.py`                  | Add `specs` to schemas                            |
| `services/backend-api/src/orm/schemas/storefront.py`               | Add `specs` to StorefrontProductResponse          |

---

## 12. Testing

- **ProductGrid:** Renders products from mocked fetch, shows empty state, shows error state
- **ProductCard:** Render with name+price, hover cross-fade, click navigates
- **ProductInfo:** Render with all sections, render without specs, size selector
- **AddToCartButton:** Click adds to cart, shows confirmation, double-click guard
- **PDP page:** Renders product info, handles 404, renders specs if present
- **MobileStickyCta:** Visibility toggle on scroll direction

---

## 13. Non-Goals

- Backend category filtering — all category routes show same product set
- Variant/size CRUD — size selector is cosmetic until variants exist
- User reviews/ratings — static placeholder
- Video assets — slot planned but stubbed
- Gender-based filtering
- Cloudinary integration — using demo URLs for POC
- Search/filter/sort on PLP
- Structured data / Schema.org markup
