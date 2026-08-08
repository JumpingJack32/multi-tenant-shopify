from collections.abc import AsyncGenerator
from contextvars import ContextVar
from uuid import UUID

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.rbac import has_permission, is_owner, validate_permission

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
current_tenant_id: ContextVar[UUID] = ContextVar("current_tenant_id", default=UUID("00000000-0000-0000-0000-000000000000"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session scoped to the current request."""
    from src.database import async_engine

    async with AsyncSession(async_engine, expire_on_commit=False) as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_current_tenant_id(
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
    authorization: str | None = Header(None),
) -> UUID:
    """Extract tenant ID from header or Bearer token payload."""
    from src.core.clerk_jwks import verify_clerk_token
    from src.core.tenant_isolation import set_tenant_context

    if x_tenant_id:
        try:
            tenant = UUID(x_tenant_id)
            set_tenant_context(tenant)
            return tenant
        except ValueError:
            pass

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            claims = await verify_clerk_token(token)
            tenant = claims.get("tenant_id")
            if tenant:
                try:
                    uuid_tenant = UUID(tenant)
                    set_tenant_context(uuid_tenant)
                    return uuid_tenant
                except ValueError:
                    pass
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing or invalid tenant context",
    )


async def get_current_user(request: Request) -> dict:
    """Extract and validate the current user from Clerk Bearer token."""
    from src.core.clerk_jwks import verify_clerk_token

    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = auth_header[7:]
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token",
        )

    try:
        claims = await verify_clerk_token(token)
        user_id = claims.get("sub") or claims.get("oid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user identifier",
            )
        return {
            "user_id": user_id,
            "email": claims.get("email"),
            "tenant_id": claims.get("tenant_id"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Clerk token: {e}",
        )


async def require_admin(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Require the current user to be a tenant admin."""
    tenant_id = user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    from src.orm.models.tenant import Tenant

    stmt = select(Tenant).where(Tenant.tenant_id == tenant_id)
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant or tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant not found or inactive",
        )

    # TODO: Verify user has admin role in tenant
    return user


async def get_current_tenant_user(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve the authenticated Clerk user to an active TenantUser row."""
    from src.orm.models.tenant import Tenant, TenantUser

    business_tenant_id = user.get("tenant_id")
    if not business_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing tenant context",
        )

    try:
        business_uuid = UUID(str(business_tenant_id))
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tenant context",
        )

    # Resolve business tenant_id -> tenants.id (PK). TenantUser.tenant_id
    # references tenants.id, while Clerk claims carry Tenant.tenant_id.
    tenant = (
        await db.exec(select(Tenant).where(Tenant.tenant_id == business_uuid))
    ).one_or_none()
    if not tenant or tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant not found or inactive",
        )

    stmt = select(TenantUser).where(
        TenantUser.tenant_id == tenant.id,
        TenantUser.clerk_user_id == user["user_id"],
    )
    tu = (await db.exec(stmt)).one_or_none()
    if not tu or not tu.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active membership in this tenant",
        )
    return tu


async def get_optional_tenant_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Resolve the actor TenantUser when a Clerk Bearer token is present.

    Returns None for header-only (X-Tenant-ID) callers so existing routes keep
    working, while still capturing the actor for audit logs when available.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    try:
        from src.orm.models.tenant import Tenant, TenantUser

        user = await get_current_user(request)
        business_tenant_id = user.get("tenant_id")
        if not business_tenant_id:
            return None
        business_uuid = UUID(str(business_tenant_id))
        tenant = (
            await db.exec(select(Tenant).where(Tenant.tenant_id == business_uuid))
        ).one_or_none()
        if not tenant:
            return None
        tu = (
            await db.exec(
                select(TenantUser).where(
                    TenantUser.tenant_id == tenant.id,
                    TenantUser.clerk_user_id == user["user_id"],
                )
            )
        ).one_or_none()
        return tu
    except Exception:
        return None


def require_permission(permission: str):
    """Route dependency factory — enforce a single permission key."""
    validate_permission(permission)

    async def dep(
        tu: TenantUser = Depends(get_current_tenant_user),
    ):
        if not has_permission(tu.role, permission, tu.is_platform_superuser):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission}",
            )
        return tu

    return dep


async def require_owner(
    tu: TenantUser = Depends(get_current_tenant_user),
):
    """Owner (or platform superuser) access only."""
    if not is_owner(tu.role, tu.is_platform_superuser):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required",
        )
    return tu
