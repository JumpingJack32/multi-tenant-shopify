from collections.abc import AsyncGenerator
from contextvars import ContextVar
from uuid import UUID, uuid4

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings

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
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()

    if not tenant or tenant.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant not found or inactive",
        )

    # TODO: Verify user has admin role in tenant
    return user
