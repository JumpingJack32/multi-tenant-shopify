# Customer Management — Phase 2: Advanced Filtering, Segments & CSV Pipelines

**Spec:** `docs/superpowers/specs/2026-07-15-customer-management.md`

---

## Step 1 — Backend: Segment & CSV Endpoints

### 1a — Install `openpyxl` for CSV parsing

```bash
cd services/backend-api && uv add openpyxl
```

### 1b — CSV Export

**File:** `services/backend-api/src/routes/customers.py`

Add `GET /customers/export` streaming CSV endpoint using `StreamingResponse`:

- Accepts same filter params as `GET /customers/` (search, status, tag, min_spent, max_spent)
- Streams rows as CSV with columns: email, first_name, last_name, phone, total_orders, total_spent, status, tags, created_at
- No pagination — full export of filtered set

### 1c — CSV Import

**File:** `services/backend-api/src/routes/customers.py`

Add `POST /customers/import` accepting multipart CSV upload:

- Parse CSV, validate email/required fields per row
- Upsert on `tenant_id + email` (ON CONFLICT DO UPDATE)
- Return: `{ total: N, created: N, updated: N, errors: [{ row, field, message }] }`

### 1d — Segment CRUD

**File:** `services/backend-api/src/routes/customers.py`

Add endpoints using existing `SavedSegment` model:

- `GET /customers/segments` — list all for tenant
- `POST /customers/segments` — create with `{ name, filters }`
- `PUT /customers/segments/{id}` — update
- `DELETE /customers/segments/{id}` — delete
- `GET /customers/segments/{id}/count` — count matching customers (preview)

---

## Step 2 — Frontend: Filter Wiring & Segment Integration

### 2a — Wire FilterPopover to page state

**File:** `apps/admin/src/app/(app)/customers/page.tsx`

- Add `activeFilters` state object in the page orchestrator
- Pass `onApply` to `FilterPopover` — merges filter values into `activeFilters`
- Pass `activeFilters` to `CustomersToolbar` — shows active filter badges
- Serialize `activeFilters` into API query params in `fetchCustomers`

### 2b — Wire import/export buttons

**Files:**

- `customers-header.tsx` — Connect Export button to `GET /customers/export`, triggers browser download
- `import-customer-dialog.tsx` — Connect file picker + upload to `POST /customers/import`, display results

### 2c — Segment UI

**File:** `apps/admin/src/components/customers/customer-drawer/tab-segmentation.tsx`

- List saved segments, click to apply filter
- "Save Current Filters as Segment" button
- Delete segment button

---

## Step 3 — Verify

```bash
# Backend
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest

# Frontend type check
pnpm --filter admin exec tsc --noEmit

# Admin tests
pnpm vitest run --project admin
```
