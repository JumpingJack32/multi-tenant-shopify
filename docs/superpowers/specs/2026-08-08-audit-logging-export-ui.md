# Advanced Audit Logging & Export UI

**Goal:** Surface the existing `audit_logs` backend (shipped in PR #51) as a full admin feature — a filterable, searchable audit trail with actor context, plus CSV export for compliance and support workflows.

---

## 1. Existing Foundation

- **`AuditLog` model** (`src/orm/models/audit_log.py`) — `tenant_id`, `actor_user_id`, `actor_email`, `action`, `resource_type`, `resource_id`, `details` (JSON), `created_at`. Indexed on `(tenant_id, created_at)`.
- **`record_audit(...)` service** (`src/services/audit_service.py`) — fire-and-forget, dedicated session, actor passed explicitly.
- **`GET /admin/audit-logs`** (`src/routes/admin_users.py:287`) — gated by `audit_logs.read`, returns last 200 entries. **No filtering, no pagination, no export.**
- **Currently wired actions:** only staff management (invite, role update, remove, transfer) in `admin_users.py`.
- **CSV pattern:** `export_orders_csv()` in `src/services/export_service.py` (StringIO + `csv.writer`).

**Gaps:**

| Gap | Impact |
|-----|--------|
| No filtering (action, actor, date, resource) | Can't investigate a specific event |
| Fixed 200-row limit, no pagination | Large tenants lose older entries |
| No CSV export | Compliance/legal can't pull records |
| Few actions wired to audit | Most high-risk operations untracked |
| No admin UI | Audit data is invisible |

---

## 2. Design Decisions

1. **Extend the existing `GET /admin/audit-logs` endpoint** (filtering + pagination) rather than a new one — reuse `require_permission("audit_logs.read")`.
2. **Add `GET /admin/audit-logs/export`** returning a CSV download (mirror `export_orders_csv` pattern).
3. **Wire more high-risk actions** to `record_audit`: refunds (store_credit.issue, orders.refund), inventory overrides, customer export, webhook config, API key changes.
4. **Admin UI** at `Settings → Audit Logs` — table with filters (action, actor email, date range, resource type), pagination, and an Export CSV button.
5. **Immutable logs** — no edit/delete endpoint. Audit logs are append-only (already true; no DELETE exists).

---

## 3. Backend changes

### 3a. Audit query params (extend `GET /admin/audit-logs`)

| Param | Type | Purpose |
|-------|------|---------|
| `action` | str | exact action key (e.g. `store_credit.issue`) |
| `actor_email` | str | partial match on actor email |
| `resource_type` | str | exact resource type |
| `resource_id` | str | exact resource id |
| `start_date` / `end_date` | ISO date | created_at range |
| `page` | int (default 1) | pagination page |
| `page_size` | int (default 50, max 200) | rows per page |

Response: `{ data: [...], pagination: { page, page_size, total, total_pages } }` — matches the `PaginatedResponse` convention already used by orders.

### 3b. CSV export (`GET /admin/audit-logs/export`)

- Same filters as list (reuse a shared `_audit_query()` builder).
- Columns: `created_at`, `actor_email`, `action`, `resource_type`, `resource_id`, `details` (JSON string).
- `StreamingResponse` with `text/csv` + `Content-Disposition: attachment; filename="audit-logs-<tenant>-<date>.csv"`.
- Gated by `audit_logs.read`.

### 3c. Wire additional high-risk actions to `record_audit`

- `src/routes/admin_rma.py` — `store_credit.issue`, `orders.refund`
- `src/routes/inventory.py` — `inventory.override`
- Customer export route — `customers.export`
- `src/routes/admin_webhooks.py` — `settings.manage_webhooks` (create/update/delete)
- API keys / settings changes — `settings.manage_api_keys`

Each uses the actor `TenantUser` already available in the route dependency.

---

## 4. Frontend changes

### 4a. New page: `Settings → Audit Logs` (`apps/admin/src/app/(app)/settings/audit-logs/page.tsx`)

- **Filters bar**: action dropdown, actor email input, resource type select, date range, Apply/Reset.
- **Table**: created_at, actor_email, action (badge), resource_type, resource_id, details (expandable/truncated).
- **Pagination**: prev/next + page count.
- **Export CSV button**: triggers `GET /admin/audit-logs/export` with current filters (download).
- **Sidebar entry** in `app-sidebar.tsx` under Settings → Audit Logs.
- Guard: render only if `can("audit_logs.read")`.

### 4b. Service + hooks

- `apps/admin/src/features/audit/api/audit-service.ts` — `fetchAuditLogs(filters, page)`, `exportAuditLogs(filters)`.
- `apps/admin/src/features/audit/hooks/use-audit-logs.ts` — TanStack Query with filter state.

---

## 5. Security

- All endpoints gated by `audit_logs.read` (already exists in the role map: `admin`, `finance`, `owner`, superuser).
- Tenant-scoped: `AuditLog.tenant_id == actor.tenant_id`.
- No write/mutate endpoints — logs are immutable.
- CSV export respects the same filters (no broader access than the UI).
- `details` JSON is rendered as escaped text, never `dangerouslySetInnerHTML`.

---

## 6. Tests

- **Backend** `test_audit_logs_api.py`:
  - list with filters (action, actor_email, date range), pagination, tenant isolation (403 cross-tenant)
  - export returns CSV with header + rows, correct Content-Type
  - 403 without `audit_logs.read` (e.g. support_agent)
- **Backend** `test_audit_service.py` (extend): verify newly-wired actions record correctly
- **Frontend** `audit-logs-page.test.tsx`:
  - renders table rows, applies filters, paginates, export button calls download

---

## 7. Execution order

1. Extend `GET /admin/audit-logs` (filters + pagination) + shared query builder
2. Add `GET /admin/audit-logs/export` (CSV)
3. Wire additional high-risk actions to `record_audit`
4. Frontend: audit service + hooks
5. Frontend: audit-logs page + sidebar entry
6. Tests + verification

---

## 8. Key decisions (summary)

- **Reuse** the existing `audit-logs` endpoint + permission — no new auth surface.
- **Streaming CSV** via the established `export_service` pattern.
- **Append-only** logs — no edit/delete.
- **Filter-aware export** — export respects the same filters as the list.
- **Tenant-isolated** and permission-gated throughout.
