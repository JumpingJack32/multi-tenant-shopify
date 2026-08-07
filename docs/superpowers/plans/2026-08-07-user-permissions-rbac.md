# Implementation Plan: User & Permissions (RBAC)

**Branch:** `feat/user-permissions`

**Spec:** `docs/superpowers/specs/2026-08-07-user-permissions-rbac.md`

---

## Step 1 — RBAC core (`src/core/rbac.py`)

- `ALL_PERMISSIONS` set (includes `customers.read`)
- `ROLE_PERMISSIONS` dict — the 7 merchant roles + finance gets `customers.read` (non-PII)
- `permissions_for_role(role)` (lru_cache)
- `has_permission(user, permission)` — superuser bypass
- `is_owner(user)`

**Files:**
- `src/core/rbac.py` (new)

---

## Step 2 — Migration: `tenant_users` columns + `audit_logs` table

- `ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status ... / invited_by / invited_at / last_login_at`
- `CREATE TABLE audit_logs` with index on `(tenant_id, created_at)`

**Files:**
- `alembic/versions/xxxx_rbac.py` (new)
- Run `alembic upgrade head`

---

## Step 3 — SQLModel classes

- Extend `TenantUser` (`src/orm/models/tenant.py`) with `status`, `invited_by`, `invited_at`, `last_login_at`
- New `AuditLog` model (`src/orm/models/audit_log.py`) + register in `__init__.py`
- Pydantic response schemas: `UserResponse`, `InviteUserRequest`, `RoleUpdateRequest`, `AuditLogResponse`

**Files:**
- `src/orm/models/tenant.py` (extend)
- `src/orm/models/audit_log.py` (new)
- `src/orm/models/__init__.py` (register)
- `src/orm/schemas/user_management.py` (new)

---

## Step 4 — Dependencies: `get_current_tenant_user`, `require_permission`, `require_owner`

- `get_current_tenant_user` — resolve Clerk user → `TenantUser` row; 403 if no active membership
- `require_permission(permission: str)` — factory returning a dependency
- `require_owner` — owner or superuser

**Files:**
- `src/dependencies.py` (extend)

---

## Step 5 — Team management API (`src/routes/admin_users.py`)

Endpoints (all tenant-scoped via `get_current_tenant_user`):
- `GET /admin/users` — list members (`settings.manage_staff` or `audit_logs.read`)
- `POST /admin/users` — invite via Clerk Invitations API (`settings.manage_staff`); idempotent re-invite; 409 if active
- `PATCH /admin/users/{id}` — role change / activate / suspend (`settings.manage_staff`)
- `DELETE /admin/users/{id}` — remove (`settings.manage_staff`; never owner)
- `POST /admin/users/{id}/transfer-ownership` — `require_owner`; atomic demote+promote transaction
- `GET /admin/permissions` — catalog + current grants (any authenticated)

Clerk helper: `src/core/clerk_api.py` → `create_clerk_invitation(email, public_metadata, redirect_url)` via `CLERK_SECRET_KEY`.

**Files:**
- `src/routes/admin_users.py` (new)
- `src/core/clerk_api.py` (new)
- `src/main.py` (mount router)

---

## Step 6 — Clerk webhook sync

- Handle `organizationInvitation.accepted` and `user.created` (when `public_metadata` has `tenant_id` + `role`)
- Match by email → set `status="active"`, `clerk_user_id`, `last_login_at`

**Files:**
- `src/routes/webhooks.py` (extend)

---

## Step 7 — Audit service

- `src/services/audit_service.py` → `record_audit(db, tenant_id, actor_id, actor_email, action, resource_type, resource_id, metadata)`
- Wire into high-risk actions via `asyncio.create_task`, **passing actor explicitly**
- `GET /admin/audit-logs` — readable via `audit_logs.read`

**Files:**
- `src/services/audit_service.py` (new)
- High-risk routes (rma, inventory, customers-export, staff) (wire)
- `src/routes/admin_users.py` (add audit-logs endpoint)

---

## Step 8 — `settings/users` page rebuild + `RbacProvider`

- Rebuild `apps/admin/src/app/(app)/settings/users/page.tsx`: working invite dialog, role dropdown per row, activate/suspend toggle, remove (disabled on owner), transfer-ownership button (owner only)
- Expand `RbacProvider` (`apps/admin/src/contexts/rbac-context.tsx`): fetch `GET /admin/permissions`, `can(permission)` checks real grants
- Add API service functions (`apps/admin/src/features/team/api/users-service.ts`)

**Files:**
- `apps/admin/src/app/(app)/settings/users/page.tsx` (rebuild)
- `apps/admin/src/contexts/rbac-context.tsx` (expand)
- `apps/admin/src/features/team/api/users-service.ts` (new)
- `apps/admin/src/features/team/hooks/use-team.ts` (new)

---

## Step 9 — Superuser tenant-switcher

- Backend: `GET /admin/tenants` (superuser only) to list tenants
- Frontend: header tenant dropdown visible when `is_platform_superuser == True`; sets active tenant context

**Files:**
- `src/routes/admin_users.py` (or `tenants.py`) add `GET /admin/tenants`
- `apps/admin/src/components/layout/superuser-tenant-switcher.tsx` (new)
- `apps/admin/src/app/(app)/layout.tsx` (render switcher)
- `apps/admin/src/contexts/tenant-context.tsx` (support override)

---

## Step 10 — Tests & verification

- Backend pytest:
  - `test_rbac.py` — permission map, `has_permission`, owner guard, transfer atomicity
  - `test_admin_users.py` — list/invite (idempotent)/role/suspend/remove/transfer API tests
  - `test_audit_service.py` — audit records with actor context
- Frontend vitest:
  - `rbac-context.test.tsx` — `can()` against fetched grants
  - `users-page.test.tsx` — invite dialog, row actions, owner-row guards
- Run: pytest, vitest, tsc, eslint, next build

**Files:**
- `services/backend-api/tests/test_rbac.py` (new)
- `services/backend-api/tests/test_admin_users.py` (new)
- `services/backend-api/tests/test_audit_service.py` (new)
- `apps/admin/src/contexts/__tests__/rbac-context.test.tsx` (new)
- `apps/admin/src/app/(app)/settings/users/__tests__/users-page.test.tsx` (new)

---

## Execution order

```
Step 1  (RBAC core)         ─┐
Step 2  (migration)         ─┤  Backend foundation
Step 3  (SQLModel)          ─┤
Step 4  (dependencies)      ─┤
Step 5  (team API + Clerk)  ─┘  Team management
Step 6  (webhook sync)      ───  Clerk lifecycle
Step 7  (audit service)     ───  Audit trail
Step 8  (users page + RBAC) ─┐
Step 9  (superuser switcher) ─┤  Frontend
Step 10 (tests + verify)    ─┘  Verification
```
