# Customer Management — Phase 2: Segmentation & Filters

**Spec:** `docs/superpowers/specs/2026-07-15-customer-management.md` §7.2
**Prerequisite:** Phase 1 complete (tag filtering backend already wired)

---

## Step 1 — Backend: SavedSegment Model

**Files:** `src/orm/models/segment.py` (new), `src/orm/models/__init__.py`

```python
class SavedSegment(BaseModel, table=True):
    __tablename__ = "saved_segments"
    name: str
    filters: dict  # JSON: {"status": "subscribed", "min_spent": 1000, "tags": ["VIP"]}
    customer_count: int = Field(default=0)
```

## Step 2 — Backend: SavedSegment Schemas

**Files:** `src/orm/schemas/segment.py` (new), `src/orm/schemas/__init__.py`

`SegmentCreate`, `SegmentUpdate`, `SegmentResponse` — standard CRUD schemas.

## Step 3 — Backend: SavedSegment Routes

**Files:** `src/routes/segments.py` (new)

`GET /segments/` — list all saved segments for tenant
`POST /segments/` — create segment with filter criteria + computed customer_count
`PUT /segments/{id}` — update
`DELETE /segments/{id}` — delete

## Step 4 — Frontend: FilterPopover Component

**New:** `apps/admin/src/components/customers/filter-popover.tsx`

Popover with: Amount Spent (min/max inputs), Subscription Status (select), Location (text input), Tags (multi-select badge input). "Apply Filters" pushes params to URL. "Save as Segment" opens a name dialog → POSTs to /segments/.

## Step 5 — Frontend: TabSegmentation Component

**New:** `apps/admin/src/components/customers/customer-drawer/tab-segmentation.tsx`

Tags display as removable badges, "Add Tag" input + button. "Search Similar" button navigates to main table with tag/location filters applied. Saved segments list (disabled / Phase 4 placeholder for "apply" action).

## Step 6 — Frontend: Wire into page.tsx and drawer

**Files:** `apps/admin/src/app/(app)/customers/page.tsx`, `apps/admin/src/components/customers/customer-drawer.tsx`

- Enable "+ Add Filter" button → opens FilterPopover
- Filter state synced to GET params (status, location, min_spent, max_spent, tag)
- Enable Segregation tab in Drawer → renders TabSegmentation
- "Search Similar" from TabSegmentation navigates to `/customers?tag=VIP`

## Step 7 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest tests/ -q     # 207 passed
cd apps/admin && npx tsc --noEmit                                      # clean
pnpm vitest run --project admin                                        # 48 passed
```
