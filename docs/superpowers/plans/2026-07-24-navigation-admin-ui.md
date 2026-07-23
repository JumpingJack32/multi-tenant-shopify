# Navigation Admin UI — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-24-navigation-admin-ui.md`
**Strategy:** Full-tree batch reconciliation via `PUT /api/v1/admin/navigation/{menu_id}/items`

---

## Step 1 — Backend: Admin CRUD Endpoints

**Files:** `src/routes/navigation_admin.py`, `src/orm/schemas/navigation.py`

- `GET /api/v1/admin/navigation` — list menus for tenant
- `GET /api/v1/admin/navigation/{menu_id}` — full tree (reuse existing tree builder)
- `PUT /api/v1/admin/navigation/{menu_id}/items` — batch reconcile (4-phase: fetch → flatten → delete missing → upsert rest)
- Add `NavigationTreePayload` + `NavigationItemPayload` request schemas

## Step 2 — Backend: Link Picker Search

Reuse existing admin search endpoints:

- `GET /api/v1/categories?q={query}`
- `GET /api/v1/collections?q={query}`
- `GET /api/v1/products?q={query}`

## Step 3 — Frontend: API Client Methods

**File:** `apps/admin/src/features/navigation/api/navigation-admin-api.ts`

- `useGetNavigationMenus()`
- `useGetNavigationTree(menuId)`
- `useReconcileNavigationTree()` — `PUT` mutation
- Search hooks for categories/collections/products

## Step 4 — Frontend: Link Picker Modal

**File:** `apps/admin/src/features/navigation/components/link-picker-modal.tsx`

- Tabbed search (Categories / Collections / Products / Custom URL)
- Debounced input → search admin endpoints
- Selection populates `ref_id` + `title` + `href`

## Step 5 — Frontend: Item Properties Drawer

**File:** `apps/admin/src/features/navigation/components/item-properties-drawer.tsx`

- Title, badge, image_url, open_in_new_tab
- is_title_link, show_view_all, is_featured toggles

## Step 6 — Frontend: Tree Builder

**Files:** `tree-builder.tsx`, `tree-item-row.tsx`

- Flatten tree to array for `@dnd-kit` computation
- Depth-projection in `onDragOver` — reject drops past depth 3
- Visual drag handles, drop indicators, indentation

## Step 7 — Frontend: Admin Page

**File:** `apps/admin/src/app/(app)/navigation/page.tsx`

- Menu selector, tree builder, save/discard workflow
- Dirty state tracking → sticky "Unsaved changes" banner

## Step 8 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit
cd apps/admin && pnpm exec eslint src/ --quiet
```
