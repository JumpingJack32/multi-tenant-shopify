# Customer Reviews & Ratings Engine — Implementation Plan

**Spec:** Customer Reviews & Ratings on PDP

---

## Step 1 — Model + Migration

**Files:** `src/orm/models/review.py`, `src/orm/schemas/review.py`

- `ProductReview`: tenant_id, product_id, customer_id, rating (1-5), title, body, reviewer_name, is_verified_buyer, status (PENDING/APPROVED/REJECTED), helpful_count
- Add `avg_rating: int` (×100, e.g. 485 = 4.85★) and `review_count: int` to `Product` model
- Alembic migration: create `product_reviews` table + add columns to `products`

## Step 2 — Review Service + Endpoints

**File:** `src/services/review_service.py`
- `create_review()` — auto-set `is_verified_buyer` by checking `OrderItem → Order.customer_email` for matching email + product
- `approve_review()` / `reject_review()` — moderation actions, recompute `avg_rating` + `review_count` on Product
- `recompute_product_rating()` — UPDATE products SET avg_rating = (SELECT ...), review_count = (SELECT ...) WHERE id = :pid

**File:** `src/routes/reviews.py`
- `GET /storefront/{tenant}/products/{product_id}/reviews` — approved reviews, sorted
- `POST /storefront/{tenant}/products/{product_id}/reviews` — submit review
- `POST /admin/reviews/{id}/helpful` — increment helpful_count
- `GET /admin/reviews` — list all (moderation queue)
- `PUT /admin/reviews/{id}/status` — approve/reject

## Step 3 — Storefront Components

**Files:** `apps/storefront/src/components/storefront/review-stars.tsx`, `apps/storefront/src/components/storefront/review-section.tsx`

- `ReviewStars` — renders ★★★★★ visual with optional numeric display
- `ReviewSection` — list of reviews with star breakdown distribution, sort, pagination
- Review submission form (rating + title + body + name)
- Wire rating badge into `ProductCard` and `ProductDetail` header

## Step 4 — Admin Moderation UI

**File:** `apps/admin/src/app/(app)/products/reviews/page.tsx`
- Table: product, reviewer, rating, date, status badge
- Bulk approve/reject actions

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
