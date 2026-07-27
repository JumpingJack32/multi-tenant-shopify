# Promotions Engine — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-27-promotions-engine.md`

---

## Step 1 — Model + Migration

**File:** `src/orm/models/promotion.py`

- `Promotion` model with `UniqueConstraint("tenant_id", "code")`
- Fields: `code` (uppercased on save), `type`, `value`, `min_subtotal`, `max_uses`, `uses_count`, `starts_at`, `ends_at`, `is_active`
- Alembic migration

## Step 2 — Discount Service + Endpoints

**File:** `src/services/discount_service.py`
- `validate_promotion(db, tenant_id, code, subtotal)` — case-insensitive lookup, checks active/dates/uses/subtotal, caps fixed discount at subtotal
- `increment_uses(db, promotion_id)` — atomic `UPDATE ... SET uses_count = uses_count + 1 WHERE id = :id AND (max_uses IS NULL OR uses_count < max_uses)`

**File:** `src/routes/promotions.py`
- `GET/POST /admin/promotions`, `PUT/DELETE /admin/promotions/{id}`
- `POST /storefront/{tenant}/promotions/validate` — returns discount + valid flag

## Step 3 — Cart Drawer + Checkout Integration

**File:** `apps/storefront/src/components/storefront/cart-drawer.tsx`
- Promo code input + Apply button
- Calls validate endpoint → shows discount line item
- Caches valid promo in local state, clears on cart change

**File:** `services/backend-api/src/routes/storefront.py`
- At checkout, call `increment_uses` for applied promo
- Store `promo_code` + `discount` on Order

## Step 4 — Admin UI

**File:** `apps/admin/src/app/(app)/discounts/promotions/page.tsx`
- Table with code, type, value, usage bar, date range, active toggle
- Create/edit dialog with all fields

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
