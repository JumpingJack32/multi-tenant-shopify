# Navigation Menu Data Model — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-24-navigation-menu-model.md`

---

## Step 1 — Backend Models

**Files:** `src/orm/models/navigation.py`, `src/orm/schemas/navigation.py`

- Create `NavigationMenu` model with `id`, `tenant_id`, `slug`, `title`
- Create `NavigationItem` model with `id`, `tenant_id`, `menu_id`, `parent_id`, `title`, `type`, `ref_id`, `href`, `sort_order`, `image_url`, `open_in_new_tab`, `is_title_link`, `show_view_all`, `is_featured`, `badge`
- Add compound index `(menu_id, parent_id, sort_order)`
- Add Pydantic `NavigationTreeResponse` with recursive `children: list[NavigationTreeResponse]`
- Run `alembic revision --autogenerate` to create migration

---

## Step 2 — API Endpoint

**File:** `src/routes/navigation.py`

- `GET /navigation/{slug}` — fetch all items in one query, build tree in Python (dict lookup, O(n))
- Resolve `ref_id` for `category`/`collection`/`product` types; filter out deleted/hidden
- Enforce max 3 depth levels

---

## Step 3 — Seed Script

**File:** `seed_database.py`

- After tenant creation, seed a default "main" menu with the fashion taxonomy (Women with 9 columns, Men/Children/Gifts/Trench/Scarves/Bags/Beauty as top-level links)

---

## Step 4 — Frontend Hook

**File:** `apps/storefront/src/features/navigation/hooks/use-navigation.ts`

- `useNavigation(slug, tenant)` via TanStack Query
- Hardcoded `womenColumns` / `topLevelLinks` arrays moved here as the **fallback default**
- API success → use tree data; API failure/404 → use fallback

---

## Step 5 — Wire into Components

**File:** `apps/storefront/src/components/storefront/site-nav.tsx`

- `SiteNav` and `MobileNav` call `useNavigation("main", tenant)` instead of importing arrays directly
- Expose `image_url` on column blocks when present
- Apply `open_in_new_tab` to links as needed

---

## Step 6 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
```
