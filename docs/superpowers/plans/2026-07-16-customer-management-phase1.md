# Customer Management — Phase 1 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-15-customer-management.md`

---

## Step 1 — Backend: Extend Customer Model + New Models

**Files:** `src/orm/models/order.py`, `src/orm/models/__init__.py`

Add to `Customer`: `email_subscription_status`, `email_subscription_type`, `tags` (JSON), `notes` (Text), `store_credit`, `last_synced_at`. New: `StoreCreditTransaction` (FK CASCADE), `CustomerTimelineEvent` (FK CASCADE).

## Step 2 — Backend: Update Schemas

**File:** `src/orm/schemas/customer.py`, `src/orm/schemas/__init__.py`

Extend all schemas with 6 new fields. Add 5 new: `StoreCreditTransactionResponse`, `StoreCreditAddRequest`, `TimelineEventResponse`, `TimelineEventCreate`, `CustomerMetricsResponse`.

## Step 3 — Backend: Rewrite Routes

**File:** `src/routes/customers.py`

Extend `GET /customers/` with filters/sorts. Add: `POST`, `PUT`, `DELETE`, `GET /metrics`, `GET|POST /{id}/timeline`, `GET|POST /{id}/credit` (with `with_for_update()`).

## Step 4 — Backend: Seed Script

**File:** `seed_database.py`

Add subscription status/type/tags to customer seeding.

## Step 5 — Backend: Verify

```bash
doppler run -- uv run pytest tests/ -q
```

Expect 207 passed.

## Step 6 — Frontend: Shared Types

**Files:** `packages/tenant-orm/src/types.ts`, `packages/tenant-orm/src/schemas/tenant.ts`

Extend `Customer` interface. Add `StoreCreditTransaction`, `TimelineEvent`, `CustomerMetrics`, `CustomerListResponse`, `StoreCreditResponse`. Update Zod schema.

## Step 7 — Frontend: API Client + Services + Hooks

**Files:** `apps/admin/src/lib/api/client.ts`, `apps/admin/src/features/customers/api/customers-service.ts`, `apps/admin/src/features/customers/hooks/use-customers.ts`

Add 7 API methods, 7 service functions, 7 hooks.

## Step 8 — Frontend: CustomersHeader

**New:** `apps/admin/src/components/customers/customers-header.tsx`

Metric bar, Import/Export/Add buttons.

## Step 9 — Frontend: CustomersToolbar

**New:** `apps/admin/src/components/customers/customers-toolbar.tsx`

Search, sort toggle, sort-by, "+ Add Filter" stub.

## Step 10 — Frontend: Rewrite CustomersTable

**File:** `apps/admin/src/components/customers/customers-table.tsx`

6 columns, checkboxes, React.memo, double-click.

## Step 11 — Frontend: CustomerDrawer + TabAccount

**New:** `apps/admin/src/components/customers/customer-drawer.tsx`, `apps/admin/src/components/customers/customer-drawer/tab-account.tsx`

Sheet with 4 tabs (Tab 1 active). Profile, timeline, notes.

## Step 12 — Frontend: AddCustomerDialog

**New:** `apps/admin/src/components/customers/add-customer-dialog.tsx`

Form: email, name, phone, subscription status.

## Step 13 — Frontend: Rewrite page.tsx + Update [id]/page.tsx

**Files:** `apps/admin/src/app/(app)/customers/page.tsx`, `apps/admin/src/app/(app)/customers/[id]/page.tsx`

Orchestrate all components. Deep linking via `searchParams.id`. `[id]` redirects to `?id=`.

## Step 14 — Verify All

```bash
doppler run -- uv run pytest tests/ -q     # 207 passed
npx tsc --noEmit                            # clean
pnpm vitest run --project admin             # 48 passed
```
