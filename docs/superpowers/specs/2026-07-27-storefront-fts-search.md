# Storefront Instant Search — Postgres Full-Text Search

**Goal:** Add sub-20ms full-text search with autocomplete, stemming, and relevancy ranking using PostgreSQL `tsvector` + GIN index.

---

## 1. Database Layer

### Migration

- Add `search_vector` column to `products` table: `tsvector`
- Populate via trigger: `search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(description,''))`
- GIN index: `CREATE INDEX ix_products_search ON products USING GIN(search_vector)`

This runs entirely server-side — no application code changes for indexing.

---

## 2. API Endpoint

**File:** `services/backend-api/src/routes/storefront.py`

```
GET /storefront/{tenant}/products/search?q=wool+trench+coat&limit=10
```

```sql
SELECT id, slug, name, min_price, max_price,
       ts_rank(search_vector, query) AS rank
FROM products,
     plainto_tsquery('english', :q) AS query
WHERE tenant_id = :tid
  AND search_vector @@ query
  AND status = 'active'
ORDER BY rank DESC
LIMIT :limit
```

Returns `list[StorefrontProductResponse]` — same schema as PLP, so the frontend `ProductCard` renders identically.

### Autocomplete variant

`GET /storefront/{tenant}/products/suggest?q=wool&limit=5`

Returns `{ suggestions: string[] }` — distinct product names matching the prefix query. Used for the typeahead dropdown.

---

## 3. Storefront Component

**File:** `apps/storefront/src/components/storefront/search-dialog.tsx`

- Trigger: search icon in the header nav bar
- Opens a command-palette-style dialog (powered by existing `Command` component from `@repo/ui`)
- On input change (debounced 300ms): fetch `/products/search?q=...`
- Renders results as small product cards with image, name, price
- Keyboard navigation (↑↓ arrows, Enter to navigate, Esc to close)
- "No results" empty state
- Clicking a result navigates to `/products/[slug]`

---

## 4. Files Changed

| File | Change |
|------|--------|
| `alembic/versions/...` | New: add `search_vector` column + GIN index + trigger |
| `src/routes/storefront.py` | New: `GET /{tenant}/products/search` + `GET /{tenant}/products/suggest` |
| `apps/storefront/src/components/storefront/search-dialog.tsx` | New: command-palette search with debounced input |
| `apps/storefront/src/app/[tenant]/layout.tsx` | Wire search dialog into header |

---

## 5. Future Vector Search Upgrade Path

```python
# Step 1: Add embedding column
ALTER TABLE products ADD COLUMN embedding vector(384);

# Step 2: Generate embeddings via Ollama/OpenAI service
async def embed_product(product):
    vec = await ai_service.embed(product.name + " " + product.description)
    product.embedding = vec

# Step 3: Hybrid search — FTS scores + vector similarity
SELECT *, ts_rank(sv, q) * 0.3 + (embedding <=> :query_vec) * 0.7 AS hybrid_rank
FROM products, plainto_tsquery('english', :q) AS q
WHERE sv @@ q OR embedding IS NOT NULL
ORDER BY hybrid_rank DESC
```
