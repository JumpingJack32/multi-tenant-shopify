# Customer Management — Specification & Implementation Plan

> **Status:** Phases 1–2 Complete — Phases 3–5 Planned  
> **Based on:** Wireframe + JSON Blueprint (2026-07-15)

---

## 🏛️ System Architecture

```
                                  +-------------------+
                                  |   Admin Portal    |
                                  |   (React/Next)    |
                                  +---------+---------+
                                            |
                         GET/POST/PUT/DELETE| JSON, CSV, Multipart
                                            v
                                  +---------+---------+
               +------------------+    FastAPI API    +------------------+
               |                  |      Engine       |                  |
               |                  +---------+---------+                  |
               v                            |                            v
     +---------+---------+                  |                   +--------+--------+
     |     Mailchimp     |                  |                   |  PostgreSQL DB  |
     |   Marketing API   |                  v                   |   (SQLAlchemy)  |
     +---------+---------+        +---------+---------+         +--------+--------+
               |                  |  BackgroundTasks  |                  |
               |                  |      Worker       |                  |
               |                  +---------+---------+                  |
               v                            |                            v
    Inbound Updates (Webhooks) -------------+----------------------------+

```

**Four phases delivered:**

1. **Foundation** — Extended Customer model, 10 REST endpoints, store credit with `with_for_update()` row locking, timeline events
2. **Segmentation & Filters** — 7-param filter/sort matrix, `FilterPopover`, `TabSegmentation`, saved segments CRUD with auto-count
3. **Bulk Import & Export** — Streaming CSV export, chunked CSV import with `ON CONFLICT` upsert, drag-and-drop UI
4. **Store Credit & Mailchimp** — Audit ledger UI, non-blocking `BackgroundTasks` sync, bidirectional webhook receiver

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Scope Summary](#2-scope-summary)
3. [Backend: Data Model Changes](#3-backend-data-model-changes)
4. [Backend: API Endpoints](#4-backend-api-endpoints)
5. [Frontend: Types & API Client](#5-frontend-types--api-client)
6. [Frontend: Page & Components](#6-frontend-page--components)
7. [Phased Implementation Plan](#7-phased-implementation-plan)
8. [Risk & Dependencies](#8-risk--dependencies)

---

## 1. Current State

### Backend (Python / FastAPI / SQLModel)

| Asset                           | File                                | Status                                                                         |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `Customer` model                | `src/orm/models/order.py:89-109`    | Exists — ecommerce fields only (email, name, phone, total_orders, total_spent) |
| `CustomerAddress` model         | `src/orm/models/order.py:112-124`   | Exists                                                                         |
| `CustomerCreate` schema         | `src/orm/schemas/customer.py:8-12`  | Exists — basic fields                                                          |
| `CustomerUpdate` schema         | `src/orm/schemas/customer.py:15-19` | Exists                                                                         |
| `CustomerResponse` schema       | `src/orm/schemas/customer.py:22-34` | Exists                                                                         |
| `CustomerDetailResponse` schema | `src/orm/schemas/customer.py:61-64` | Exists                                                                         |
| `GET /customers/`               | `src/routes/customers.py:19-50`     | Exists — paginated, searchable, read-only                                      |
| `GET /customers/{id}`           | `src/routes/customers.py:53-89`     | Exists — detail with addresses + orders                                        |
| Mailchimp integration           | —                                   | **Does not exist**                                                             |
| CSV import/export               | —                                   | **Does not exist**                                                             |
| Store credit ledger             | —                                   | **Does not exist**                                                             |
| Tags / segmentation             | —                                   | **Does not exist**                                                             |
| Subscriber status               | —                                   | **Does not exist**                                                             |
| Router registration             | `src/main.py:184`                   | `app.include_router(customers_router, prefix="/api/v1")`                       |

### Frontend (Next.js / TanStack Query / shadcn/ui / Tailwind v4)

| Asset                               | File                                                             | Status                                               |
| ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| `CustomersPage`                     | `apps/admin/src/app/(app)/customers/page.tsx`                    | Exists — minimal: title + `<CustomersTable>`         |
| `CustomerDetailPage`                | `apps/admin/src/app/(app)/customers/[id]/page.tsx`               | Exists — route-based detail page                     |
| `CustomersTable` component          | `apps/admin/src/components/customers/customers-table.tsx`        | Exists — 4 columns, search, pagination               |
| `CustomerProfile` component         | `apps/admin/src/components/customers/customer-profile.tsx`       | Exists — 2-column grid: profile card + order history |
| `fetchCustomers` service            | `apps/admin/src/features/customers/api/customers-service.ts`     | Exists                                               |
| `fetchCustomer` service             | `apps/admin/src/features/customers/api/customers-service.ts`     | Exists                                               |
| `useCustomers` hook                 | `apps/admin/src/features/customers/hooks/use-customers.ts`       | Exists                                               |
| `useCustomer` hook                  | `apps/admin/src/features/customers/hooks/use-customers.ts`       | Exists                                               |
| API client methods                  | `apps/admin/src/lib/api/client.ts:143-158`                       | Exists — `customers.list()` + `customers.get()`      |
| `Customer` / `CustomerDetail` types | `packages/tenant-orm/src/types.ts:154-193`                       | Exists                                               |
| `CustomerSchema` Zod                | `packages/tenant-orm/src/schemas/tenant.ts:121-134`              | Exists                                               |
| Sidebar nav                         | `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx:99` | Exists — "Customers" under Management                |

---

## 2. Scope Summary

The wireframe describes a **customer/subscriber management hub** replacing the current minimal customers page. Key features:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ METRIC BAR: [3,000 Customers]  15% of base   [Import ▾] [Export] [+ Add]│
│                                               [+ Add Filter]            │
├─────────────────────────────────────────────────────────────────────────┤
│ SEARCH: [🔍 Search...]  [⇅]  [Sort By ▾]                               │
│ TABLE:  checkbox | Name | Subscription | Location | Orders | Spent     │
│         (double-click row → opens DRAWER)                               │
├─────────────────────────────────────────────────────────────────────────┤
│ DRAWER TABS:                                                            │
│   Tab 1 — Customer Accounts (profile, management, timeline)             │
│   Tab 2 — Segmentation (tags, segments, search similar)                 │
│   Tab 3 — Import/Export Tools (Mailchimp sync, CSV error resolver)      │
│   Tab 4 — Customer Service & Store Credit (ledger, timeline, notes)     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend: Data Model Changes

### 3.1 Extended `Customer` Model

Add these columns to the existing `Customer` model (`src/orm/models/order.py:89-109`):

```python
# New fields for subscription/management
email_subscription_status: str = Field(default="subscribed")  # subscribed | unsubscribed | bounced
email_subscription_type: str = Field(default="digital")  # digital | print+digital | print
tags: dict = Field(default_factory=dict, sa_column=Column(JSON))  # {"vip": true, "q3-campaign": true}
notes: str | None = Field(default=None, sa_column=Column(Text))
store_credit: int = Field(default=0, ge=0)  # in pence (same as total_spent)
last_synced_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
```

**Migration:** Generate Alembic revision. Note: no migrations directory exists yet (globbing found none), so the initial migration infrastructure may need to be set up, or tables recreated from metadata as done in CI (`conftest.py`).

### 3.2 New Models

#### `StoreCreditTransaction`

```python
class StoreCreditTransaction(BaseModel, table=True):
    __tablename__ = "store_credit_transactions"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.tenant_id")
    customer_id: UUID = Field(foreign_key="customers.id", ondelete="CASCADE")
    amount: int  # positive = credit, negative = debit (in pence)
    balance_after: int
    reason: str  # "Compensation for damaged Q1 magazine"
    created_by: UUID | None = None  # admin user ID
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
```

#### `CustomerTimelineEvent`

```python
class CustomerTimelineEvent(BaseModel, table=True):
    __tablename__ = "customer_timeline_events"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.tenant_id")
    customer_id: UUID = Field(foreign_key="customers.id", ondelete="CASCADE")
    event_type: str  # note | email_sent | credit_added | credit_deducted | status_change | tag_added | tag_removed | imported
    description: str
    metadata: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_by: UUID | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), sa_column=Column(DateTime(timezone=True)))
```

#### `SavedSegment` (optional, Phase 4)

```python
class SavedSegment(BaseModel, table=True):
    __tablename__ = "saved_segments"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.tenant_id")
    name: str
    filters: dict  # JSON representation of filter criteria
    customer_count: int = Field(default=0)
    created_at: datetime
    updated_at: datetime
```

### 3.3 Model Registration

Add all new models to `src/orm/models/__init__.py`.

---

## 4. Backend: API Endpoints

### 4.1 Enhanced `GET /customers/`

Add query parameters to the existing list endpoint:

| Param        | Type | Default      | Description                                                  |
| ------------ | ---- | ------------ | ------------------------------------------------------------ |
| `search`     | str  | —            | Searches email, first_name, last_name                        |
| `status`     | str  | —            | `subscribed`, `unsubscribed`, `bounced`                      |
| `location`   | str  | —            | Country or city filter                                       |
| `min_spent`  | int  | —            | Minimum total_spent in pence                                 |
| `max_spent`  | int  | —            | Maximum total_spent in pence                                 |
| `tag`        | str  | —            | Filter by tag key (e.g. `vip`)                               |
| `sort_by`    | str  | `created_at` | `name`, `email`, `total_spent`, `total_orders`, `created_at` |
| `sort_order` | str  | `desc`       | `asc` or `desc`                                              |
| `page`       | int  | 1            | Page number                                                  |
| `per_page`   | int  | 20           | Items per page (max 100)                                     |

**Response shape:**

```json
{
  "data": [CustomerResponse],
  "total": 3000,
  "page": 1,
  "per_page": 20,
  "metrics": {
    "total_customers": 3000,
    "total_base": 20000,
    "percentage": 15.0
  }
}
```

### 4.2 `POST /customers/`

Create a new customer. Accepts `CustomerCreate` body. Returns `CustomerResponse`.

### 4.3 `PUT /customers/{id}`

Update customer fields (email, name, phone, notes, tags, email_subscription_status). Returns `CustomerResponse`.

### 4.4 `DELETE /customers/{id}`

Soft-delete or hard-delete customer. Returns 204.

### 4.5 `GET /customers/{id}/timeline`

Returns `list[TimelineEventResponse]` for the customer's activity timeline.

### 4.6 `POST /customers/{id}/timeline`

Add a manual note to the timeline.

```json
{
  "event_type": "note",
  "description": "Called about missing Q1 issue"
}
```

### 4.7 Store Credit Endpoints

#### `GET /customers/{id}/credit`

Returns current balance + transaction history:

```json
{
  "balance": 1500,
  "transactions": [
    {
      "id": "...",
      "amount": 1500,
      "reason": "Compensation for damaged Q1 magazine",
      "created_at": "..."
    }
  ]
}
```

#### `POST /customers/{id}/credit`

Add or deduct credit:

```json
{
  "amount": 1500,
  "reason": "Compensation for damaged Q1 magazine"
}
```

Creates a `StoreCreditTransaction`, updates `Customer.store_credit`, and adds a timeline event.

**Implementation note:** Use `with_for_update()` on the customer row to prevent race conditions:

```python
stmt = select(Customer).where(Customer.id == customer_id).with_for_update()
```

### 4.8 `POST /customers/import/csv`

Accepts CSV file upload. Parses, validates, returns preview of errors:

```json
{
  "total_rows": 500,
  "successful": 498,
  "errors": [
    {
      "row": 24,
      "field": "email",
      "value": "john.doe_at_gmail.com",
      "message": "Invalid email format"
    }
  ]
}
```

### 4.9 `POST /customers/import/csv/resolve`

After admin corrects errors in-browser, submits corrected rows:

```json
{
  "corrections": [{ "row": 24, "email": "john.doe@gmail.com" }]
}
```

This endpoint applies the corrected rows and completes the import.

### 4.10 `POST /customers/import/mailchimp`

Accepts Mailchimp API key + audience/segment ID from a request body. Returns similar preview as CSV import. (Stub in Phase 2, full implementation in Phase 3.)

### 4.11 `POST /customers/export`

Triggers CSV generation and returns a download URL or streams the file.

### 4.12 `GET /customers/metrics`

Returns aggregate stats:

```json
{
  "total_customers": 3000,
  "total_base": 20000,
  "subscribed": 2800,
  "unsubscribed": 150,
  "bounced": 50,
  "with_store_credit": 45,
  "total_store_credit": 75000,
  "avg_spent": 3250
}
```

---

## 5. Frontend: Types & API Client

### 5.1 Extended Types (`packages/tenant-orm/src/types.ts`)

```typescript
export interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_verified: boolean;
  total_orders: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
  // NEW:
  email_subscription_status: "subscribed" | "unsubscribed" | "bounced";
  email_subscription_type: "digital" | "print+digital" | "print";
  tags: Record<string, boolean>;
  notes: string | null;
  store_credit: number;
  last_synced_at: string | null;
}

export interface StoreCreditTransaction {
  id: string;
  customer_id: string;
  amount: number;
  balance_after: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  customer_id: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface CustomerMetrics {
  total_customers: number;
  total_base: number;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  with_store_credit: number;
  total_store_credit: number;
  avg_spent: number;
}

export interface CustomerListResponse {
  data: Customer[];
  total: number;
  page: number;
  per_page: number;
  metrics: CustomerMetrics;
}

export interface ImportPreview {
  total_rows: number;
  successful: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  value: string;
  message: string;
}
```

### 5.2 Extended API Client (`apps/admin/src/lib/api/client.ts`)

```typescript
customers: {
  list(params?, options?) // enhanced response type
  get(id, options?)
  create(data, options?)
  update(id, data, options?)
  delete(id, options?)
  getTimeline(id, options?)
  addTimelineEvent(id, data, options?)
  getCredit(id, options?)
  addCredit(id, data, options?)
  importCsv(file, options?)
  resolveCsvErrors(data, options?)
  importMailchimp(config, options?)
  exportCsv(params?, options?)
  getMetrics(options?)
}
```

### 5.3 Extended Service & Hooks

New service functions + hooks for:

- `useCustomerMetrics` — fetches metrics for metric bar
- `useCustomerTimeline(customerId)` — fetches timeline events
- `useCustomerCredit(customerId)` — fetches credit balance + history
- `useImportCsv` — mutation for CSV upload
- `useImportMailchimp` — mutation for Mailchimp sync
- `useExportCsv` — mutation for CSV export
- `useCreateCustomer` — mutation for add customer
- `useUpdateCustomer` — mutation for edit customer
- `useAddCredit` — mutation for store credit
- `useAddTimelineEvent` — mutation for timeline notes

---

## 6. Frontend: Page & Components

### 6.1 Page Structure (Replaces current `customers/page.tsx`)

```
apps/admin/src/app/(app)/customers/
├── page.tsx                   ← CustomersPage (rewritten)
├── components/
│   ├── customers-page.tsx     ← Main orchestrator component
│   ├── customers-header.tsx   ← Metric bar + action buttons
│   ├── customers-toolbar.tsx  ← Search + sort + filters
│   ├── customers-table.tsx    ← Rewritten: 6 columns, double-click
│   ├── customer-drawer.tsx    ← Sheet drawer with tabs
│   ├── customer-drawer/
│   │   ├── tab-account.tsx    ← Tab 1: Profile, management, timeline
│   │   ├── tab-segmentation.tsx ← Tab 2: Tags, segments, search similar
│   │   ├── tab-integrations.tsx  ← Tab 3: Mailchimp, CSV error resolver
│   │   └── tab-credit.tsx     ← Tab 4: Store credit ledger + service timeline
│   ├── add-customer-dialog.tsx ← "Add Customer" form dialog
│   ├── import-dialog.tsx      ← CSV upload + Mailchimp sync dialog
│   ├── csv-error-resolver.tsx ← Inline CSV error correction dialog
│   └── filter-popover.tsx     ← "+ Add Filter" popover with criteria
```

**Page layout (Tailwind v4):**

```
<div class="p-6 space-y-6">
  <CustomersHeader metrics={} onImport onExport onAdd />   ← metric bar + actions
  <CustomersToolbar search sort filter />                   ← search + sort + filter
  <CustomersTable data onRowDoubleClick />                  ← main table
  <Pagination />                                            ← page controls
  <CustomerDrawer customerId open onClose />                ← drawer (overlay)
</div>
```

### 6.2 Component Specifications

#### `CustomersHeader`

- **Left:** Large text "3,000 Customers" + muted "15% of total customer base"
- **Right:** `<DropdownMenu>` for Import (Import CSV, Mailchimp Sync, Resolve CSV Errors), `<Button variant="outline">` for Export, `<Button variant="default">` for Add Customer
- **shadcn:** `Card`, `Button`, `DropdownMenu`

#### `CustomersToolbar`

- **Search:** `<Input placeholder="Search customer..." className="max-w-md">` with Search icon
- **Sort toggle:** `<Button variant="outline" size="icon">` with `ArrowUpDown` icon, toggles asc/desc
- **Sort by:** `<Select>` with options: Name, Subscription, Location, Orders, Spent
- **Filter button:** `<Popover>` trigger with "+ Add Filter", contains filter criteria form (amount spent range, location, status, tags)
- **shadcn:** `Input`, `Button`, `Select`, `Popover`, `Command`

#### `CustomersTable` (rewritten)

- **Columns:** Checkbox (bulk select), Customer Name (with email subtitle), Email Subscription (badge), Location, Orders (count), Amount Spent (formatted)
- **Interaction:** Single-click checkbox for bulk, double-click row → opens `CustomerDrawer`
- **States:** Loading skeleton (5 rows), empty state ("No customers yet"), error state (`ErrorBanner`)
- **shadcn:** `Table`, `Checkbox`, `Badge`, `Skeleton`

#### `CustomerDrawer`

- **Trigger:** `onDoubleClick` on table row sets `selectedCustomerId` state
- **Content:** `<Sheet>` with `<Tabs>` (4 tabs)
- **Width:** `w-[500px] sm:w-[600px]`
- **shadcn:** `Sheet`, `SheetContent`, `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `ScrollArea`

#### Tab 1 — Customer Accounts (`tab-account.tsx`)

- Profile info: Name, Email, Phone, Location
- Management actions: Reset password link, toggle account activation, view login history
- Activity timeline: list of `TimelineEvent` items with icons per type
- Action buttons: "Send Email", "Send Store Credit Notification"
- Internal notes: textarea + "Add Note" button
- **shadcn:** `Card`, `Input`, `Textarea`, `Button`, `Badge`, `Separator`, `ScrollArea`

#### Tab 2 — Segmentation (`tab-segmentation.tsx`)

- Current segments: display active tags as badges with remove button
- Add tag: `<Input>` + "Add" button (adds key to `tags` dict)
- Search similar profiles: button that triggers search with matching tags/location
- Saved segments: list of `SavedSegment` with apply button (Phase 4)
- **shadcn:** `Badge`, `Input`, `Button`, `Card`

#### Tab 3 — Import/Export Tools (`tab-integrations.tsx`)

- **Mailchimp section:**
  - Shows last sync timestamp
  - "Sync from Mailchimp" button → opens `ImportDialog` in Mailchimp mode
- **CSV Error Resolver section:**
  - Shows error count if any unresolved errors exist
  - "Open Error Log" button → opens `CsvErrorResolver` dialog
- **shadcn:** `Card`, `Button`, `Badge`, `Separator`

#### Tab 4 — Customer Service & Store Credit (`tab-credit.tsx`)

- **Store Credit Ledger:**
  - Current balance (large text, formatted)
  - "Add Credit" / "Deduct Credit" input fields with reason textarea
  - Transaction history table: date, amount (+/-), reason, running balance
- **Customer Service Timeline:**
  - Reverse-chronological list of service events
  - Each event shows type icon, description, timestamp, admin
- **shadcn:** `Card`, `Input`, `Button`, `Table`, `Badge`, `Separator`, `ScrollArea`

#### `AddCustomerDialog`

- Modal dialog with form: Email, First Name, Last Name, Phone
- On submit → `POST /customers/`, then refetch list
- **shadcn:** `Dialog`, `DialogContent`, `Input`, `Button`, `Label`

#### `ImportDialog`

- Tabbed: "Upload CSV" / "Sync from Mailchimp"
- CSV: drag & drop zone, file picker, upload progress, preview errors
- Mailchimp: API key input, audience selector, segment selector
- **shadcn:** `Dialog`, `Tabs`, `Input`, `Button`, `Progress`

#### `CsvErrorResolver`

- Table of errors: row number, field, invalid value, corrected value (editable input)
- "Apply Corrections & Resume Import" button
- **shadcn:** `Dialog`, `Table`, `Input`, `Button`, `Badge`

#### `FilterPopover`

- Filter criteria form: Amount Spent (min/max), Location (country select), Subscription Status (select), Tags (multi-select)
- "Apply Filters" + "Save as Segment" buttons
- **shadcn:** `Popover`, `Command`, `Input`, `Select`, `Button`

---

## 7. Phased Implementation Plan

### Phase 1 — Foundation (Backend + Frontend Core)

**Goal:** Working customers page with metric bar, enhanced table, drawer with Tab 1 (Account Profile).

**Backend tasks:**

1. Extend `Customer` model with subscription fields, tags, notes, store_credit, last_synced_at
2. Generate Alembic migration
3. Add `sort_by`, `sort_order`, `status`, `location`, `min_spent`, `max_spent`, `tag` query params to `GET /customers/`
4. Add `POST /customers/` create endpoint
5. Add `PUT /customers/{id}` update endpoint
6. Add `DELETE /customers/{id}` delete endpoint
7. Add `GET /customers/metrics` endpoint
8. Update `CustomerResponse` / `CustomerDetailResponse` schemas with new fields

**Frontend tasks:**

1. Update `Customer` / `CustomerDetail` types in `@repo/tenant-orm`
2. Update API client methods
3. Add `useCustomerMetrics`, `useCreateCustomer`, `useUpdateCustomer` hooks
4. Rewrite `page.tsx` — metric bar, toolbar, table, drawer orchestration with `searchParams.id` deep linking
5. Build `CustomersHeader` component
6. Build `CustomersToolbar` component (search + sort toggle + sort by)
7. Rewrite `CustomersTable` — 6 columns, double-click handler, `React.memo` + `useCallback` optimization
8. Build `CustomerDrawer` shell with tabs
9. Build `TabAccount` — profile info, management actions, timeline, notes
10. Build `AddCustomerDialog`
11. Keep `[id]/page.tsx` as redirect to `?id=` for shareable URLs

**Tests:**

- Backend: Update `test_customers.py` (or create) — test new filters, sorts, create/update/delete
- Frontend: Update `CustomersTable` tests, add drawer tests

---

### Phase 2 — Segmentation & Filters

**Goal:** Tags, dynamic filtering, "+ Add Filter" popover.

**Backend tasks:**

1. Ensure tag filtering works in `GET /customers/`
2. Add saved segments model and CRUD endpoints

**Frontend tasks:**

1. Build `FilterPopover` with all filter criteria
2. Wire filter state to API params
3. Build `TabSegmentation` — tags display, add/remove tags
4. "Save as Segment" button

---

### Phase 3 — Import & Export

**Goal:** CSV import with inline error resolver, CSV export.

**Backend tasks:**

1. CSV parsing service (`src/services/csv_import.py`)
   - Use Python `csv` module + Pydantic validation
   - Validate email, required fields
   - Return structured error list
2. `POST /customers/import/csv` — upload + preview
3. `POST /customers/import/csv/resolve` — apply corrections
4. `POST /customers/export` — generate CSV download
5. Update `seed_database.py` seed script if needed

**Frontend tasks:**

1. Build `ImportDialog` with CSV upload tab
2. Build `CsvErrorResolver` with inline correction table
3. Build export button handler (downloads CSV)
4. Build `TabIntegrations` — Mailchimp section (stub), CSV error resolver section

---

### Phase 4 — Mailchimp Integration & Store Credit

**Goal:** Full Mailchimp sync, store credit ledger with timeline.

**Backend tasks:**

1. `src/services/mailchimp_service.py` — Mailchimp API client
   - Uses `httpx` (already a dependency)
   - Methods: `list_audiences()`, `list_segments()`, `pull_contacts()`
2. Store credit model + migration
3. Timeline model + migration
4. Store credit endpoints (`GET/POST /customers/{id}/credit`)
5. Timeline endpoints (`GET/POST /customers/{id}/timeline`)
6. `POST /customers/import/mailchimp` endpoint

**Frontend tasks:**

1. Build `ImportDialog` Mailchimp tab (API key, audience picker)
2. Build `TabCredit` — balance display, add/deduct, transaction history
3. Wire timeline into `TabAccount`
4. Wire Mailchimp sync button in `TabIntegrations`

---

### Phase 5 — Polish & Edge Cases

**Goal:** Bulk selection, saved segments, loading skeletons, error handling, responsive.

**Frontend tasks:**

1. Bulk checkbox selection state management
2. Bulk actions toolbar (delete, export selected, add tag)
3. Saved segments in `TabSegmentation`
4. Responsive drawer width
5. Keyboard navigation in table
6. Empty states for all tabs

---

## 8. Risk & Dependencies

| Risk                                                    | Impact                                                       | Mitigation                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No migration infrastructure (no `migrations/versions/`) | Blocking for Phase 1                                         | Use `ensure_tables` fixture pattern (as in CI `conftest.py`) or set up Alembic from scratch                                                                                                                                                                                                                     |
| CSV parsing with large files                            | Poor UX                                                      | Stream parsing, chunked upload, 10MB limit, progress indicator                                                                                                                                                                                                                                                  |
| Mailchimp API key management                            | Security                                                     | Store in Doppler, never expose to frontend; proxy through backend                                                                                                                                                                                                                                               |
| Double-click vs single-click UX                         | Confusion                                                    | Single-click selects (checkbox), double-click opens drawer — match platform convention                                                                                                                                                                                                                          |
| Store credit race condition                             | Lost updates                                                 | Use `SELECT ... FOR UPDATE` with `with_for_update()` on the customer row (same as `fulfillment_router.py` pattern)                                                                                                                                                                                              |
| Tags as JSON dict vs separate table                     | Query complexity                                             | JSON dict is simpler for tags-as-booleans; switch to join table if tag-based filtering becomes a performance bottleneck                                                                                                                                                                                         |
| GIN index on `tags` column                              | `json` type (not `jsonb`) does not support GIN in PostgreSQL | Either (a) convert column to `JSONB` and add `Index("ix_customers_tags", "tags", postgresql_using="gin")`, or (b) use `jsonb_path_ops` operator class. Pre-migration step: `ALTER COLUMN tags TYPE JSONB USING tags::jsonb`; then `CREATE INDEX ix_customers_tags ON customers USING gin (tags jsonb_path_ops)` |
| Large table re-renders during search                    | Poor UX on 3,000+ rows                                       | Wrap `CustomerRow` in `React.memo()`, use `useCallback` for handlers, `useMemo` for derived data                                                                                                                                                                                                                |
| No existing `tsconfig.json` paths for new components    | Build errors                                                 | Follow existing `@/` alias pattern                                                                                                                                                                                                                                                                              |

---

## 9. Code Review Corrections (Applied 2026-07-15)

The following corrections were applied after the initial implementation was code-reviewed. They should be respected in all future phases.

### 9.1 Store Credit: Row Locking

The `POST /customers/{id}/credit` endpoint **must** use `with_for_update()` to lock the customer row during the read-modify-write of `store_credit`:

```python
stmt = (
    select(Customer)
    .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    .with_for_update()
)
customer = (await db.exec(stmt)).one_or_none()
```

This prevents race conditions when two admin requests modify store credit simultaneously. The pattern matches the existing `fulfillment_router.py:39` and `abandoned_cart.py:84`.

### 9.2 Deep Linking: Do Not Remove `[id]/page.tsx`

The drawer detail view must support shareable URLs. Two approaches work together:

1. **`/customers?id=12345`** — `searchParams.id` triggers the drawer via `useEffect`
2. **`/customers/12345`** — `[id]/page.tsx` redirects to `/customers?id=12345` for backward compatibility

Implementation in `page.tsx`:

```typescript
const searchParams = useSearchParams();

useEffect(() => {
  const idFromUrl = searchParams.get("id");
  if (idFromUrl) setDrawerCustomerId(idFromUrl);
}, [searchParams]);
```

When the user double-clicks a row, push the URL: `router.push(\`/customers?id=${customer.id}\`, { scroll: false })`.
When the drawer closes, restore: `router.push("/customers", { scroll: false })`.

The `[id]/page.tsx` file must be kept (not deleted) as a simple redirect:

```typescript
export default function CustomerDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/customers?id=${params.id}`);
  }, []);
  return null;
}
```

### 9.3 GIN Index on Tags — JSONB Required

The `tags` column uses SQLAlchemy `JSON` type, which maps to PostgreSQL `json`. GIN indexes do not support `json` — they require `jsonb`.

**Pre-migration steps (before adding the index):**

```sql
ALTER TABLE customers ALTER COLUMN tags TYPE JSONB USING tags::jsonb;
```

**Then in the migration:**

```python
op.create_index('ix_customers_tags', 'customers', ['tags'], postgresql_using='gin', postgresql_ops={'tags': 'jsonb_path_ops'})
```

Alternatively, skip the GIN index if the customer base is under 50k records and rely on the `tenant_id` index for partition pruning.

### 9.4 Table Performance: React.memo + useCallback

The `CustomersTable` component must:

1. Extract `CustomerRow` into a **`React.memo`-wrapped** component to prevent re-renders of all rows when search text changes
2. Wrap event handlers (`handleSelectAll`, `handleSelectOne`, `handleDoubleClick`) in **`useCallback`**
3. Use **`useMemo`** for derived values like `allSelected`

```
CustomerRow = memo(function CustomerRow({ customer, isSelected, onSelect, onDoubleClick }) { ... })
```

### 9.5 Multi-tenant Isolation

The `StoreCreditTransaction` and `CustomerTimelineEvent` models inherit `tenant_id` from `BaseModel` (where it is `Optional[UUID]`). All queries must filter by `tenant_id` to prevent cross-tenant data leakage — this is enforced through the `tenant_id` parameter on all route endpoints via `get_current_tenant_id`. The `GET /customers/{id}/timeline` route demonstrates the pattern:

```python
stmt = (
    select(CustomerTimelineEvent)
    .where(CustomerTimelineEvent.customer_id == customer_id, Customer.tenant_id == tenant_id)
    .join(Customer)
)
```

---

## Appendix A: File Change Inventory

### Backend (new/modified)

| File                                | Change Type                                                           |
| ----------------------------------- | --------------------------------------------------------------------- |
| `src/orm/models/order.py`           | Modify `Customer` — add fields                                        |
| `src/orm/models/__init__.py`        | Add `StoreCreditTransaction`, `CustomerTimelineEvent`, `SavedSegment` |
| `src/orm/schemas/customer.py`       | Update all schemas with new fields                                    |
| `src/orm/schemas/__init__.py`       | Export new schemas                                                    |
| `src/routes/customers.py`           | Rewrite — add all endpoints                                           |
| `src/services/csv_import.py`        | New — CSV parsing/validation                                          |
| `src/services/mailchimp_service.py` | New — Mailchimp API client                                            |
| `migrations/versions/`              | New migration(s)                                                      |
| `seed_database.py`                  | Add seed data for new fields                                          |
| `tests/test_customers.py`           | New — comprehensive tests                                             |

### Frontend (new/modified)

| File                                                                       | Change Type                                        |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| `packages/tenant-orm/src/types.ts`                                         | Extend `Customer`, add new types                   |
| `packages/tenant-orm/src/schemas/tenant.ts`                                | Update Zod schemas                                 |
| `apps/admin/src/lib/api/client.ts`                                         | Add new customer API methods                       |
| `apps/admin/src/features/customers/api/customers-service.ts`               | Add new service functions                          |
| `apps/admin/src/features/customers/hooks/use-customers.ts`                 | Add new hooks                                      |
| `apps/admin/src/app/(app)/customers/page.tsx`                              | Rewrite                                            |
| `apps/admin/src/components/customers/customers-table.tsx`                  | Rewrite                                            |
| `apps/admin/src/components/customers/customer-profile.tsx`                 | Rewrite as `TabAccount` inside drawer              |
| `apps/admin/src/app/(app)/customers/[id]/page.tsx`                         | Keep — redirect to `?id=` for deep linking support |
| `apps/admin/src/components/customers/customers-header.tsx`                 | New                                                |
| `apps/admin/src/components/customers/customers-toolbar.tsx`                | New                                                |
| `apps/admin/src/components/customers/customer-drawer.tsx`                  | New                                                |
| `apps/admin/src/components/customers/customer-drawer/tab-account.tsx`      | New                                                |
| `apps/admin/src/components/customers/customer-drawer/tab-segmentation.tsx` | New                                                |
| `apps/admin/src/components/customers/customer-drawer/tab-integrations.tsx` | New                                                |
| `apps/admin/src/components/customers/customer-drawer/tab-credit.tsx`       | New                                                |
| `apps/admin/src/components/customers/add-customer-dialog.tsx`              | New                                                |
| `apps/admin/src/components/customers/import-dialog.tsx`                    | New                                                |
| `apps/admin/src/components/customers/csv-error-resolver.tsx`               | New                                                |
| `apps/admin/src/components/customers/filter-popover.tsx`                   | New                                                |
