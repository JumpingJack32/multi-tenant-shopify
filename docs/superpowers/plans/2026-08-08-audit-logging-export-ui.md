# Implementation Plan: Advanced Audit Logging & Export UI

**Branch:** `feat/audit-logging-export`

**Spec:** `docs/superpowers/specs/2026-08-08-audit-logging-export-ui.md`

**Refinements locked in:**
1. Shared query helper `build_audit_log_query(tenant_id, filters)` in `audit_service.py` — list + export use identical filtering
2. Composite index on `(tenant_id, created_at)` supports filtered/sorted pagination; `actor_email` ILIKE stays bounded by tenant+created_at
3. CSV `details` JSON escaped via `csv.writer` (StringIO) — prevents CSV formula-injection

---

## Step 1 — Audit query helper + filters in `audit_service.py`

- Add `AuditLogFilters` dataclass / kwargs: `action`, `actor_email` (ILIKE), `resource_type`, `resource_id`, `start_date`, `end_date`
- `build_audit_log_query(tenant_id, filters) -> SelectOfScalar[AuditLog]`:
  - `tenant_id ==` always
  - Optional filters each applied conditionally
  - `actor_email` via `AuditLog.actor_email.ilike(f"%{term}%")`
  - `order_by(created_at.desc())`
- Migrate existing `record_audit` unaffected (append-only)

**Files:**
- `src/services/audit_service.py` (add helper)

---

## Step 2 — Composite index migration

- `CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC)`
- Replace/verify existing `(tenant_id, created_at)` index

**Files:**
- `alembic/versions/xxxx_audit_index.py` (new)
- Apply to migration DB + app DB

---

## Step 3 — Extend `GET /admin/audit-logs` (filters + pagination)

- Use `build_audit_log_query`
- Query params: `action`, `actor_email`, `resource_type`, `resource_id`, `start_date`, `end_date`, `page` (1), `page_size` (50, max 200)
- Response `PaginatedResponse[AuditLogResponse]`: `{ data, pagination: { page, page_size, total, total_pages } }`
- `total` via `func.count()` with same filters

**Files:**
- `src/routes/admin_users.py` (rewrite endpoint)
- `src/orm/schemas/user_management.py` (add pagination wrapper if needed)

---

## Step 4 — Add `GET /admin/audit-logs/export` (CSV)

- Same `build_audit_log_query` + filters (filter-aware export)
- Columns: `created_at`, `actor_email`, `action`, `resource_type`, `resource_id`, `details`
- `details` serialized via `json.dumps(details)` then written through `csv.writer(StringIO)` — escaping prevents formula injection (`=`, `+`, `-`, `@` prefixes)
- `StreamingResponse` with `text/csv`, `Content-Disposition: attachment; filename="audit-logs-<tenant>-<yyyymmdd>.csv"`

**Files:**
- `src/routes/admin_users.py` (add endpoint)
- `src/services/audit_service.py` (add `export_audit_logs_csv(db, tenant_id, filters) -> str`)

---

## Step 5 — Wire additional high-risk actions to `record_audit`

| Route | Action key |
|-------|-----------|
| `admin_rma.py` refund / store credit | `orders.refund`, `store_credit.issue` |
| `inventory.py` override | `inventory.override` |
| customer export route | `customers.export` |
| `admin_webhooks.py` create/update/delete | `settings.manage_webhooks` |
| API keys / settings | `settings.manage_api_keys` |

Actor passed explicitly (`actor_user_id=tu.id, actor_email=tu.email`) using the existing `TenantUser` dependency.

**Files:**
- `src/routes/admin_rma.py`, `src/routes/inventory.py`, customers export route, `src/routes/admin_webhooks.py`, settings routes

---

## Step 6 — Frontend service + hooks

- `apps/admin/src/features/audit/api/audit-service.ts`:
  - `fetchAuditLogs(filters, page, page_size)` → `PaginatedResponse`
  - `exportAuditLogs(filters)` → triggers download (fetch blob, create object URL, anchor click)
- `apps/admin/src/features/audit/hooks/use-audit-logs.ts` — TanStack Query, filter state

**Files:**
- `apps/admin/src/features/audit/api/audit-service.ts` (new)
- `apps/admin/src/features/audit/hooks/use-audit-logs.ts` (new)

---

## Step 7 — Frontend page: `Settings → Audit Logs`

- `apps/admin/src/app/(app)/settings/audit-logs/page.tsx`
  - Filters bar: action select, actor email input, resource type select, date range, Apply/Reset
  - Table: created_at, actor_email, action badge, resource_type, resource_id, details (truncated w/ expand)
  - Pagination controls
  - Export CSV button (uses current filters)
- Sidebar entry in `app-sidebar.tsx` under Settings → Audit Logs
- Render only if `can("audit_logs.read")`

**Files:**
- `apps/admin/src/app/(app)/settings/audit-logs/page.tsx` (new)
- `packages/ui/src/components/blocks/dashboard/app-sidebar.tsx` (add entry)

---

## Step 8 — Tests + verification

- **Backend** `tests/test_audit_logs_api.py`:
  - list filters (action, actor_email ILIKE, date range, resource_type)
  - pagination (page/page_size/total)
  - tenant isolation (cross-tenant 403/empty)
  - export CSV: header + rows, Content-Type, filename; formula-injection guard (`=` prefix becomes quoted)
  - 403 without `audit_logs.read`
- **Backend** extend `tests/test_audit_service.py` for new actions
- **Frontend** `audit-logs-page.test.tsx`: renders rows, applies filters, paginates, export button
- Full verify: pytest, vitest, tsc, eslint, next build

**Files:**
- `services/backend-api/tests/test_audit_logs_api.py` (new)
- `services/backend-api/tests/test_audit_service.py` (extend)
- `apps/admin/src/app/(app)/settings/audit-logs/__tests__/audit-logs-page.test.tsx` (new)

---

## Execution order

```
Step 1  (query helper)          ─┐
Step 2  (index migration)       ─┤  Backend foundation
Step 3  (list + pagination)     ─┤
Step 4  (CSV export)            ─┘
Step 5  (wire high-risk actions)──  Coverage expansion
Step 6  (frontend service+hooks)─┐
Step 7  (audit-logs page)       ─┤  Frontend
Step 8  (tests + verify)        ─┘  Verification
```
