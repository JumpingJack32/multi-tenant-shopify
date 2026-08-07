"""Team management & RBAC admin endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.rbac import ALL_PERMISSIONS, MANAGEABLE_ROLES, ROLE_PERMISSIONS
from src.dependencies import get_current_tenant_user, get_db, require_owner, require_permission
from src.orm.models.tenant import Tenant, TenantUser
from src.orm.schemas.user_management import (
    AuditLogResponse,
    InviteUserRequest,
    PermissionCatalogResponse,
    RoleUpdateRequest,
    UserResponse,
)

router = APIRouter(tags=["admin-users"])


def _user_response(tu: TenantUser) -> UserResponse:
    return UserResponse(
        id=tu.id,
        email=tu.email,
        role=tu.role,
        status=tu.status,
        is_active=tu.is_active,
        is_platform_superuser=tu.is_platform_superuser,
        invited_at=tu.invited_at,
        last_login_at=tu.last_login_at,
    )


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: TenantUser = Depends(require_permission("settings.manage_staff")),
    actor: TenantUser = Depends(get_current_tenant_user),
):
    """List team members for the actor's tenant."""
    stmt = (
        select(TenantUser)
        .where(TenantUser.tenant_id == actor.tenant_id)
        .order_by(TenantUser.created_at)
    )
    result = await db.exec(stmt)
    return [_user_response(u) for u in result.all()]


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(
    payload: InviteUserRequest,
    db: AsyncSession = Depends(get_db),
    actor: TenantUser = Depends(require_permission("settings.manage_staff")),
):
    """Invite a team member via Clerk Invitations API."""
    if payload.role not in MANAGEABLE_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")

    email = str(payload.email).lower()
    existing = (
        await db.exec(
            select(TenantUser).where(
                TenantUser.tenant_id == actor.tenant_id,
                TenantUser.email == email,
            )
        )
    ).one_or_none()

    if existing and existing.status == "active":
        raise HTTPException(status_code=409, detail="User already active in this tenant")

    from src.core.clerk_api import create_clerk_invitation

    try:
        invitation_id = await create_clerk_invitation(
            email=email,
            public_metadata={
                "tenant_id": str(actor.tenant_id),
                "role": payload.role,
            },
            redirect_url="http://localhost:3001/auth/sign-in",
        )
    except RuntimeError:
        # Clerk not configured — degrade to a local pending record (dev mode)
        invitation_id = "local"
    except Exception:
        invitation_id = "local"

    if existing:
        # Idempotent re-invite: resend, refresh timestamps, return existing
        existing.status = "invited"
        existing.role = payload.role
        existing.invited_at = datetime.now()
        existing.invited_by = actor.id
        db.add(existing)
        await db.flush()
        await db.refresh(existing)
        from src.services.audit_service import record_audit
        record_audit(
            tenant_id=actor.tenant_id, actor_user_id=actor.id, actor_email=actor.email,
            action="settings.manage_staff.invite", resource_type="tenant_user",
            resource_id=str(existing.id), details={"email": email, "role": payload.role},
        )
        return _user_response(existing)

    new_user = TenantUser(
        tenant_id=actor.tenant_id,
        clerk_user_id="",
        email=email,
        password_hash="",
        role=payload.role,
        status="invited",
        is_active=True,
        invited_by=actor.id,
        invited_at=datetime.now(),
    )
    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)
    from src.services.audit_service import record_audit
    record_audit(
        tenant_id=actor.tenant_id, actor_user_id=actor.id, actor_email=actor.email,
        action="settings.manage_staff.invite", resource_type="tenant_user",
        resource_id=str(new_user.id), details={"email": email, "role": payload.role},
    )
    return _user_response(new_user)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    payload: RoleUpdateRequest,
    db: AsyncSession = Depends(get_db),
    actor: TenantUser = Depends(require_permission("settings.manage_staff")),
):
    """Change a member's role or activation status."""
    target = (
        await db.exec(
            select(TenantUser).where(
                TenantUser.id == user_id,
                TenantUser.tenant_id == actor.tenant_id,
            )
        )
    ).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if target.role == "owner" and (payload.role != "owner" or payload.status == "suspended" or payload.is_active is False):
        raise HTTPException(status_code=400, detail="Cannot demote or deactivate the owner")

    if payload.role is not None:
        if payload.role not in MANAGEABLE_ROLES:
            raise HTTPException(status_code=400, detail=f"Invalid role: {payload.role}")
        target.role = payload.role
    if payload.status is not None:
        target.status = payload.status
    if payload.is_active is not None:
        target.is_active = payload.is_active

    db.add(target)
    await db.flush()
    await db.refresh(target)
    from src.services.audit_service import record_audit
    record_audit(
        tenant_id=actor.tenant_id, actor_user_id=actor.id, actor_email=actor.email,
        action="settings.manage_staff.update", resource_type="tenant_user",
        resource_id=str(target.id), details=payload.model_dump(exclude_none=True),
    )
    return _user_response(target)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: TenantUser = Depends(require_permission("settings.manage_staff")),
):
    """Remove a team member. The owner can never be removed."""
    target = (
        await db.exec(
            select(TenantUser).where(
                TenantUser.id == user_id,
                TenantUser.tenant_id == actor.tenant_id,
            )
        )
    ).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    await db.delete(target)
    await db.flush()
    from src.services.audit_service import record_audit
    record_audit(
        tenant_id=actor.tenant_id, actor_user_id=actor.id, actor_email=actor.email,
        action="settings.manage_staff.remove", resource_type="tenant_user",
        resource_id=str(target.id), details={"email": target.email},
    )
    return None


@router.post("/users/{user_id}/transfer-ownership", response_model=UserResponse)
async def transfer_ownership(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    actor: TenantUser = Depends(require_owner),
):
    """Transfer the owner role. Runs in an atomic transaction so the tenant
    is never left with 0 or 2 owners."""
    if actor.id == user_id:
        raise HTTPException(status_code=400, detail="Already the owner")

    target = (
        await db.exec(
            select(TenantUser).where(
                TenantUser.id == user_id,
                TenantUser.tenant_id == actor.tenant_id,
            )
        )
    ).one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    # get_db already wraps the session in a transaction — demote + promote
    # atomically within it, then commit.
    actor.role = "admin"
    db.add(actor)
    target.role = "owner"
    db.add(target)
    await db.flush()
    await db.refresh(target)
    from src.services.audit_service import record_audit
    record_audit(
        tenant_id=actor.tenant_id, actor_user_id=actor.id, actor_email=actor.email,
        action="settings.transfer_ownership", resource_type="tenant_user",
        resource_id=str(target.id), details={"from": str(actor.id), "to": str(target.id)},
    )
    return _user_response(target)


@router.get("/permissions", response_model=PermissionCatalogResponse)
async def get_permission_catalog(
    _: TenantUser = Depends(get_current_tenant_user),
    actor: TenantUser = Depends(get_current_tenant_user),
):
    """Expose the permission catalog plus the current user's grants."""
    my_permissions = (
        list(ALL_PERMISSIONS)
        if actor.is_platform_superuser
        else sorted(ROLE_PERMISSIONS.get(actor.role, set()))
    )
    return PermissionCatalogResponse(
        permission_keys=sorted(ALL_PERMISSIONS),
        role_permissions={r: sorted(p) for r, p in ROLE_PERMISSIONS.items()},
        my_permissions=my_permissions,
        my_role="superuser" if actor.is_platform_superuser else actor.role,
    )


@router.get("/tenants")
async def list_all_tenants(
    db: AsyncSession = Depends(get_db),
    _: TenantUser = Depends(get_current_tenant_user),
    actor: TenantUser = Depends(get_current_tenant_user),
):
    """List all tenants — platform superuser only."""
    if not actor.is_platform_superuser:
        raise HTTPException(status_code=403, detail="Superuser access required")
    result = await db.exec(select(Tenant).order_by(Tenant.name))
    return [
        {
            "id": str(t.id),
            "tenant_id": str(t.tenant_id),
            "name": t.name,
            "slug": t.slug,
            "status": t.status.value if hasattr(t.status, "value") else str(t.status),
        }
        for t in result.all()
    ]


@router.get("/audit-logs", response_model=list[AuditLogResponse])
async def list_audit_logs(
    db: AsyncSession = Depends(get_db),
    _: TenantUser = Depends(require_permission("audit_logs.read")),
    actor: TenantUser = Depends(get_current_tenant_user),
):
    """List audit log entries for the tenant."""
    from src.orm.models.audit_log import AuditLog

    stmt = (
        select(AuditLog)
        .where(AuditLog.tenant_id == actor.tenant_id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
    )
    result = await db.exec(stmt)
    return [AuditLogResponse.model_validate(a) for a in result.all()]
