# Navigation Menu Data Model

Replace the hardcoded `womenColumns` / `topLevelLinks` arrays with a tenant-scoped database model, served via API.

---

## 1. Backend Models

### NavigationMenu

Stored per-tenant, one row per menu (e.g. "main", "footer").

```python
class NavigationMenu(BaseModel, table=True):
    __tablename__ = "navigation_menus"

    id: UUID
    tenant_id: UUID = Field(foreign_key="tenants.tenant_id")
    slug: str = Field(max_length=100)        # "main", "footer"
    title: str = Field(max_length=200)       # "Primary Navigation"
```

### NavigationItem (refined)

`tenant_id` duplicated here for explicit tenant isolation — prevents cross-tenant leaks via raw SQL or queries that join only on `menu_id`.

Compound index on `(menu_id, parent_id, sort_order)` for the single flat fetch that builds the tree in memory.

```python
class NavigationItem(BaseModel, table=True):
    __tablename__ = "navigation_items"

    id: UUID
    tenant_id: UUID = Field(foreign_key="tenants.tenant_id", index=True)
    menu_id: UUID = Field(foreign_key="navigation_menus.id", index=True)
    parent_id: Optional[UUID] = Field(None, foreign_key="navigation_items.id", index=True)

    title: str = Field(max_length=200)
    type: str = Field(max_length=50)     # "category" | "collection" | "product" | "custom" | "editorial"
    ref_id: Optional[UUID] = None        # FK when type != "custom"
    href: Optional[str] = None           # Custom URL when type = "custom" / "editorial"
    sort_order: int = 0

    image_url: Optional[str] = None      # Promo thumbnail / category image
    open_in_new_tab: bool = False        # External link target
    is_title_link: bool = False          # Column heading is itself a link
    show_view_all: bool = False          # Show "View All" link
    is_featured: bool = False            # Editorial spotlight
    badge: Optional[str] = None          # "New", "Sale", "Coming Soon"

    __table_args__ = (
        sa.Index("ix_nav_menu_parent_sort", "menu_id", "parent_id", "sort_order"),
    )
```

### Depth limit

API enforces max **3 levels**: Top Category → Column Header → Sub-link. Any deeper items are flattened to level 3 on read. Admin UI validator rejects deeper inserts.

### Broken reference resolution

When `type` is `category`, `collection`, or `product`, the endpoint resolves `ref_id` against the target table. Deleted/unpublished entities are **excluded** from the response tree (item is omitted, not rendered as a dead link).

---

## 2. API Endpoint

```
GET /api/v1/{tenant}/navigation/{slug}
```

**Implementation:**

1. Fetch all items for `menu_id` + `tenant_id` in a single query ordered by `sort_order`
2. Build nested tree in Python using a dict lookup (O(n) — no recursive queries)
3. Resolve `ref_id` targets, filtering out deleted/hidden entities
4. Enforce max 3 levels

Returns the full tree:

```json
{
  "id": "...",
  "slug": "main",
  "title": "Primary Navigation",
  "items": [
    {
      "title": "Women",
      "type": "editorial",
      "children": [
        {
          "title": "Latest",
          "type": "editorial",
          "is_title_link": true,
          "children": [
            { "title": "New", "type": "custom", "href": "/women/latest/new" }
          ]
        },
        {
          "title": "Coats & Jackets",
          "type": "category",
          "ref_id": "uuid...",
          "show_view_all": true,
          "children": [...]
        }
      ]
    },
    { "title": "Men", "type": "editorial", "children": [] }
  ]
}
```

---

## 3. Frontend

- New hook `useNavigation(slug, tenant)` fetches the tree via TanStack Query
- `SiteNav` and `MobileNav` consume the hook instead of the hardcoded arrays
- **Fallback:** hardcoded arrays remain as defaults. If API fails or returns 404, the nav renders the static data instead of hiding entirely. `console.error` + Sentry capture on failure.

---

## 4. Future Admin UI

- New admin page `/admin/navigation` with a tree builder (drag-to-reorder, add/remove items)
- Link picker modal that searches categories, collections, and products
- Preview in desktop + mobile viewports

---

## Files Changed

| File                                   | Change                                             |
| -------------------------------------- | -------------------------------------------------- |
| `src/orm/models/navigation.py`         | New: NavigationMenu + NavigationItem models        |
| `src/orm/schemas/navigation.py`        | New: Pydantic response schemas                     |
| `src/routes/navigation.py`             | New: `GET /navigation/{slug}` endpoint             |
| `seed_database.py`                     | Seed default menu per tenant                       |
| `site-nav.tsx`                         | Add `useNavigation()` hook with hardcoded fallback |
| `apps/admin/src/app/(app)/navigation/` | New: admin UI (future milestone)                   |
