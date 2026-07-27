# Storefront FTS Search — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-27-storefront-fts-search.md`

---

## Step 1 — Migration

- Add `search_vector tsvector` column to `products` + GIN index
- Add trigger function that updates `search_vector` on INSERT or UPDATE of name/description
- Backfill existing products: `UPDATE products SET search_vector = to_tsvector('english', name || ' ' || coalesce(description, ''))`

## Step 2 — Search Endpoints

**File:** `src/routes/storefront.py`
- `GET /{tenant}/products/search?q=` — uses `websearch_to_tsquery`, returns `list[StorefrontProductResponse]`
- `GET /{tenant}/products/suggest?q=` — prefix match via `to_tsquery('english', 'q:*')`, returns `{ suggestions: string[] }`

## Step 3 — Search Dialog

**File:** `apps/storefront/src/components/storefront/search-dialog.tsx`
- Command-palette dialog triggered by search icon in header
- Debounced input (300ms) → fetches `/products/search`
- Renders product cards with image, name, price
- Keyboard navigation, Esc to close
- Empty state

## Step 4 — Wire into Layout

**File:** `apps/storefront/src/app/[tenant]/layout.tsx`
- Import and mount `<SearchDialog />` in the header

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
