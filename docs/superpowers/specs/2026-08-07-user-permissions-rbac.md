# User & Permissions — Role-Based Access Control (RBAC)

**Goal:** Replace the current 3-role stub (`admin`/`member`/`viewer`) with a production-grade RBAC system matching the e-commerce role matrix, including a platform-level superuser, Clerk-backed invitations, and fine-grained permission enforcement in both the FastAPI backend and the Next.js admin UI.

---

## 1. Existing Foundation

- **`TenantUser` model** (`src/orm/models/tenant.py:52`) — `tenant_id`, `clerk_user_id`, `email`, `password_hash`, `role` (string), `is_active`, `is_platform_superuser`. Unique on `(tenant_id, clerk_user_id)`.
- **`RbacProvider`** (`apps/admin/src/contexts/rbac-context.tsx`) — 3-role stub reading Clerk session claims; exposes `can(action)`.
- **`require_admin` dependency** (`src/dependencies.py:102`) — checks tenant exists/active; **does NOT verify the user's role** (has a `TODO`).
- **`settings/users` page** (`apps/admin/src/app/(app)/settings/users/page.tsx`) — dead scaffold: read-only table, non-functional invite dialog calling `request("/admin/users")` which **404s** (no such backend endpoint).
- **`admin_auth.py`** — legacy email/password auth for tenants; separate from Clerk.

**Gaps:** no team-management API, no permission catalog, no role enforcement, no invite flow, no owner guard, no superuser bypass.

---

## 2. Decision Lock (from architectural review)

1. **Fixed static role→permission map** in code (dict constant). Enforcement evaluates **permission keys** (`customers.export`), never role names, so custom roles can be added later by moving the map to DB without touching route/UI logic.
2. **Clerk Invitations API** for invites — `POST /admin/users` creates a Clerk invitation + a pending `TenantUser` row (`status=invited`); a Clerk webhook (`user.created` / `organizationMembership.created`) flips it to `active`.
3. **Superuser = backend bypass + tenant-switcher dropdown** (no standalone dashboard). `is_platform_superuser` skips tenant scoping; admin UI shows a header tenant-switcher only for superusers.

---

## 3. Roles & Permission Catalog

### Roles

| Role | slug |
|------|------|
| Store Owner | `owner` |
| Store Administrator | `admin` |
| Operations Manager | `ops_manager` |
| Support Agent | `support_agent` |
| Catalog Specialist | `catalog_specialist` |
| Marketing Manager | `marketing_manager` |
| Finance / Accountant | `finance` |
| Platform Superuser | `superuser` (via `is_platform_superuser`, not a `role` value) |

### Permission keys

```
# Customers / PII
customers.read              customers.read_pii          customers.export
# Orders / Financial
orders.read                 orders.edit                 orders.refund
store_credit.issue          finance.view_payouts        finance.view_reports
# Catalog / Inventory
products.read               products.create             products.edit
products.bulk_price         inventory.view              inventory.override
# Marketing
marketing.campaigns         marketing.discounts         marketing.analytics
# Settings / Security
settings.manage_staff       settings.manage_billing     settings.manage_webhooks
settings.manage_api_keys    settings.transfer_ownership audit_logs.read
```

> **Invariant (refinement):** `customers.read` **must** be in `ALL_PERMISSIONS`. Grant `finance` explicit `customers.read` (non-PII) so financial managers can resolve order-associated customer IDs without 403s on standard order detail views. `customers.read_pii` and `customers.export` remain restricted.

### `ROLE_PERMISSIONS` map (fixed, in `src/core/rbac.py`)

```python
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "owner": ALL_PERMISSIONS,
    "admin": ALL_PERMISSIONS
             - {"settings.transfer_ownership", "settings.manage_billing"},
    "ops_manager": {
        "orders.read", "orders.edit", "orders.refund",
        "inventory.view", "inventory.override", "store_credit.issue",
    },
    "support_agent": {
        "customers.read", "customers.read_pii",
        "orders.read", "orders.edit",
    },
    "catalog_specialist": {
        "products.read", "products.create", "products.edit",
        "products.bulk_price", "inventory.view",
    },
    "marketing_manager": {
        "marketing.campaigns", "marketing.discounts", "marketing.analytics",
        "finance.view_reports",
    },
    "finance": {
        "orders.read", "customers.read",
        "finance.view_payouts", "finance.view_reports",
        "audit_logs.read",
    },
}
```

**Rules encoded in the matrix:**
- Support agent: no revenue reports, no global pricing, no customer export.
- Finance: read-only across orders; no product/store edits; no refunds.
- Ops manager: no global settings, no payouts, no team creation.
- Catalog specialist: no order processing, no customer data, no payouts.
- Marketing: no fulfillment, no direct refunds, no system config.

---

## 4. Database Schema (migration)

### Add columns to `tenant_users`

```sql
ALTER TABLE tenant_users
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',   -- invited | active | suspended
    ADD COLUMN IF NOT EXISTS invited_by UUID,
    ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
```

**Existing `role`** stays a string (kept for backward compat with `admin_auth.py`). `is_active` remains. `is_platform_superuser` remains for the superuser flag.

### New `audit_logs` table (high-risk action trail)

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    actor_user_id UUID,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,        -- e.g. 'store_credit.issue'
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_created
    ON audit_logs (tenant_id, created_at DESC);
```

### Owner guard (application-enforced, not DB constraint)

Exactly 1 `owner` per tenant. The owner cannot be deactivated, deleted, or demoted. Demotion/transfer only via `POST /admin/users/{id}/transfer-ownership`.

---

## 5. SQLModel classes

### `TenantUser` (extended, `src/orm/models/tenant.py`)

```python
class TenantUser(SQLModel, table=True):
    __tablename__ = "tenant_users"
    __table_args__ = (
        Index("ix_tenant_users_tenant_clerk_id", "tenant_id", "clerk_user_id"),
        UniqueConstraint("tenant_id", "clerk_user_id", name="uq_tenant_users_tenant_clerk_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", ondelete="CASCADE")
    clerk_user_id: str = Field(default="", max_length=255)
    email: str = Field(max_length=255)
    password_hash: str = Field(max_length=255)
    role: str = Field(default="member", max_length=50)
    status: str = Field(default="active", max_length=20)   # invited | active | suspended
    is_active: bool = Field(default=True)
    is_platform_superuser: bool = Field(default=False)
    invited_by: UUID | None = Field(default=None)
    invited_at: datetime | None = Field(default=None)
    last_login_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())
```

### `AuditLog` (new `src/orm/models/audit_log.py`)

```python
class AuditLog(BaseModel, table=True):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    tenant_id: UUID = Field(index=True)
    actor_user_id: UUID | None = None
    actor_email: str | None = Field(default=None, max_length=255)
    action: str = Field(max_length=100)
    resource_type: str | None = Field(default=None, max_length=50)
    resource_id: str | None = Field(default=None, max_length=100)
    metadata: dict = Field(default_factory=dict, sa_column=Column(JSON))
```

---

## 6. Backend — RBAC core (`src/core/rbac.py`)

```python
from functools import lru_cache
from src.orm.models.tenant import TenantUser

ALL_PERMISSIONS: set[str] = {
    "customers.read", "customers.read_pii", "customers.export",
    "orders.read", "orders.edit", "orders.refund",
    "store_credit.issue", "finance.view_payouts", "finance.view_reports",
    "products.read", "products.create", "products.edit", "products.bulk_price",
    "inventory.view", "inventory.override",
    "marketing.campaigns", "marketing.discounts", "marketing.analytics",
    "settings.manage_staff", "settings.manage_billing", "settings.manage_webhooks",
    "settings.manage_api_keys", "settings.transfer_ownership", "audit_logs.read",
}

ROLE_PERMISSIONS: dict[str, set[str]] = { ... }   # from §3

@lru_cache
def permissions_for_role(role: str) -> set[str]:
    return ROLE_PERMISSIONS.get(role, set())

def has_permission(user: TenantUser, permission: str) -> bool:
    if user.is_platform_superuser:
        return True
    return permission in permissions_for_role(user.role)

def is_owner(user: TenantUser) -> bool:
    return user.role == "owner"
```

---

## 7. Backend — FastAPI dependencies (`src/dependencies.py`)

```python
async def get_current_tenant_user(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantUser:
    """Resolve the authenticated Clerk user to a TenantUser row."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(401, "Missing tenant context")
    stmt = select(TenantUser).where(
        TenantUser.tenant_id == tenant_id,
        TenantUser.clerk_user_id == user["user_id"],
    )
    tu = (await db.exec(stmt)).one_or_none()
    if not tu or not tu.is_active:
        raise HTTPException(403, "No active membership in this tenant")
    return tu


def require_permission(permission: str):
    """Route dependency: enforce a single permission key."""
    async def dep(
        tu: TenantUser = Depends(get_current_tenant_user),
    ) -> TenantUser:
        if not has_permission(tu, permission):
            raise HTTPException(403, f"Missing permission: {permission}")
        return tu
    return dep


async def require_owner(
    tu: TenantUser = Depends(get_current_tenant_user),
) -> TenantUser:
    if not is_owner(tu) and not tu.is_platform_superuser:
        raise HTTPException(403, "Owner access required")
    return tu
```

**Usage in a route:**

```python
from src.dependencies import get_db, require_permission, require_owner

@router.post("/orders/{order_id}/refund")
async def refund_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: TenantUser = Depends(require_permission("orders.refund")),
):
    ...

@router.post("/users/{user_id}/transfer-ownership")
async def transfer_ownership(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: TenantUser = Depends(require_owner),
):
    ...
```

---

## 8. Backend — Team management API (new `src/routes/admin_users.py`)

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| `GET` | `/admin/users` | `settings.manage_staff` or `audit_logs.read` | List team members |
| `POST` | `/admin/users` | `settings.manage_staff` | Invite via Clerk Invitations API |
| `PATCH` | `/admin/users/{id}` | `settings.manage_staff` | Change role / activate / suspend |
| `DELETE` | `/admin/users/{id}` | `settings.manage_staff` | Remove member (never the owner) |
| `POST` | `/admin/users/{id}/transfer-ownership` | `require_owner` | Transfer owner role |
| `GET` | `/admin/permissions` | any authenticated | Permission catalog + current grants |

**Invite flow (`POST /admin/users`):**

```python
async def _sync_clerk_invitation(db, tenant, email, role, invited_by) -> str:
    import stripe  # pattern reference; actual Clerk SDK below
    from src.core.clerk_api import create_clerk_invitation   # new helper
    invitation = await create_clerk_invitation(
        email=email,
        public_metadata={"tenant_id": str(tenant.tenant_id), "role": role},
        redirect_url=f"{ADMIN_BASE_URL}/auth/sign-in",
    )
    return invitation.id
```

1. Validate email + role.
2. Create `TenantUser` with `status="invited"`, `invited_by`, `invited_at`, `role`.
3. Call Clerk Invitations API with `public_metadata` carrying `tenant_id` + `role`.
4. Return the pending member; status flips to `active` via Clerk webhook.

**Transfer ownership transaction safety:** `POST /admin/users/{id}/transfer-ownership` must run inside an **explicit database transaction**:
1. Demote current owner (`role = "admin"`).
2. Promote target user (`role = "owner"`).
3. Commit atomically — a tenant must never be left with 0 or 2 owners if an error occurs mid-flight. On any exception, roll back and return 500.

**Clerk webhook handler** (extend `src/routes/webhooks.py`): listen for **`organizationInvitation.accepted`** (and `user.created` when `public_metadata` carries `tenant_id` + `role`) → match by email → set `TenantUser.status="active"`, `clerk_user_id`, `last_login_at`.

> **Idempotency (refinement):** `POST /admin/users` — if a `TenantUser` with the email already exists in `status="invited"`, **resend** the Clerk invitation (return 200 with the existing record) instead of raising a duplicate error. If status is `active`, return a 409 conflict.

---

## 9. Superuser tenant-switcher

- **Backend:** `has_permission` returns `True` for `is_platform_superuser`. Add `GET /admin/tenants` (superuser only) to list all tenants for the switcher.
- **Frontend:** In `SiteHeader`, render a tenant dropdown when `is_platform_superuser == True`. Selecting a tenant sets the active tenant context (cookie/header) so the superuser can inspect any store. Reuses the existing `TenantProvider` mechanics.

---

## 10. Frontend — `settings/users` page rebuild

- **Invite dialog**: functional — calls `POST /admin/users` with email + role; shows loading/error; refreshes list.
- **Table rows**: role dropdown (owner only sees demote for non-owners; cannot touch the owner row), activate/suspend toggle, remove action (disabled on owner).
- **Transfer ownership**: owner-only button on non-owner rows with confirmation.
- **Guards**: hide/disable actions via `can("settings.manage_staff")`.

### `RbacProvider` expansion

- Fetch `GET /admin/permissions` → `{ permissionKeys, myPermissions }`.
- `can(permission: string): boolean` checks `myPermissions`.
- Replace the Clerk-claims stub. Keep `role` for display.

---

## 11. Audit trail

- New `src/services/audit_service.py` with `record_audit(db, tenant_id, actor, action, resource_type, resource_id, metadata)`.
- Call it (fire-and-forget via `asyncio.create_task` to match existing patterns) on:
  - `store_credit.issue`, `inventory.override`, `customers.export`
  - `settings.manage_staff` actions (invite, role change, suspend, remove, transfer)
  - `settings.manage_webhooks`, `settings.manage_api_keys`
- Audit logs readable via `audit_logs.read` permission.

> **Context awareness (refinement):** `record_audit` must capture the actor's actual `clerk_user_id` / `TenantUser.id`, not `None`. When invoked inside `asyncio.create_task`, **pass the actor user object explicitly into the background task signature** (`asyncio.create_task(_record_audit(db, actor_id=tu.id, actor_email=tu.email, ...))`) rather than relying on request-scoped state that is lost once the task runs outside the request lifecycle.

---

## 12. Execution Order

1. `src/core/rbac.py` — permission catalog + `ROLE_PERMISSIONS` + helpers
2. Migration — `tenant_users` new columns + `audit_logs` table
3. SQLModel — extend `TenantUser`, add `AuditLog`
4. Dependencies — `get_current_tenant_user`, `require_permission`, `require_owner`
5. `admin_users.py` — team CRUD + transfer + permissions endpoints
6. Clerk invitations helper + webhook sync
7. Audit service + wire into high-risk actions
8. `settings/users` page rebuild + `RbacProvider` expansion
9. Superuser tenant-switcher in header
10. Tests (backend pytest + frontend vitest) + verification

---

## 13. Key Decisions (Summary)

- **Permission keys, not role names**, in all enforcement → future custom roles only change storage, not routes/UI.
- **Fixed `ROLE_PERMISSIONS`** map in code for v1.
- **Clerk Invitations API** for invites; webhook transitions `invited → active`.
- **Owner guard**: exactly 1 owner; owner can't be demoted/deleted/deactivated except via transfer-ownership.
- **Superuser**: `is_platform_superuser` bypasses tenant scoping; header tenant-switcher only for superusers; no standalone dashboard yet.
- **Audit trail** on high-risk actions, tied into the existing background-task pattern.
