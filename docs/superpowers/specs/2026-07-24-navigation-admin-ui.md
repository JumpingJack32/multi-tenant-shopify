# Navigation Admin UI

Admin CRUD for managing navigation menus and items per tenant.

---

## 1. Backend CRUD Endpoints

All under `/api/v1/navigation/`, tenant-scoped.

| Method   | Path                        | Description                                                             |
| -------- | --------------------------- | ----------------------------------------------------------------------- |
| `GET`    | `/navigation/main`          | Existing — returns tree                                                 |
| `PUT`    | `/navigation/main`          | Update menu title                                                       |
| `POST`   | `/navigation/items`         | Create item (body includes `parent_id`, `type`, `ref_id`, `href`, etc.) |
| `PUT`    | `/navigation/items/{id}`    | Update item fields                                                      |
| `DELETE` | `/navigation/items/{id}`    | Delete item (cascades to children)                                      |
| `PUT`    | `/navigation/items/reorder` | Batch update `sort_order` and `parent_id` for drag-and-drop             |

All items validated against `ALLOWED_TYPES` = `["category", "collection", "product", "custom", "editorial"]`.

### Link picker endpoint

`GET /navigation/link-picker?q=&type=category|collection|product`

Returns search results for the link picker modal:

```json
{
  "categories": [{ "id": "...", "name": "Coats & Jackets", "path": "/women/coats-jackets", "product_count": 12 }],
  "collections": [...],
  "products": [...]
}
```

---

## 2. Admin UI Page

**Route:** `apps/admin/src/app/(app)/navigation/page.tsx`

### Layout

- Left sidebar: list of menus (currently just "main")
- Right panel: tree builder for selected menu

### Tree Builder

- Renders the item tree as nested rows with indentation
- Each row: drag handle, title, type badge, edit/delete buttons
- "Add item" button at root level and under each parent
- Drag-and-drop reorder (persisted via `PUT /navigation/items/reorder`)

### Item Form

Sliding panel (Sheet) with fields:

- Title (text)
- Type (Select: category / collection / product / custom / editorial)
- Link picker (when type = category/collection/product — opens search modal)
- URL (text, when type = custom/editorial)
- Image URL (text, optional)
- Open in new tab (checkbox)
- Is title link (checkbox)
- Show view all (checkbox)
- Badge (text, optional)

### Link Picker Modal

- Tabbed search: Categories | Collections | Products
- Search input filters results client-side
- Clicking a result sets `ref_id` and closes the modal

---

## 3. Files Changed

| File                                           | Change                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/routes/navigation_admin.py`               | New: CRUD endpoints for admin                                                    |
| `src/orm/schemas/navigation.py`                | Add request schemas (NavigationItemCreate, NavigationItemUpdate, ReorderPayload) |
| `apps/admin/src/app/(app)/navigation/page.tsx` | New: admin page with tree builder                                                |
| `apps/admin/src/features/navigation/`          | New: hooks + API client methods                                                  |
