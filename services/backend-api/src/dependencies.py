from collections.abc import AsyncGenerator
from contextvars import ContextVar
from uuid import UUID

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
    if x_tenant_id:
        try:
            tenant = UUID(x_tenant_id)
            current_tenant_id.set(tenant)
            return tenant
        except ValueError:
            pass

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        parts = token.split(".")
        if len(parts) >= 2:
            import base64
            import json

            payload = parts[1]
            payload += "=" * (4 - len(payload) % 4)
            try:
                decoded = json.loads(base64.urlsafe_b64decode(payload))
                tenant = decoded.get("tenant_id") or decoded.get("sub")
                if tenant:
                    try:
                        uuid_tenant = UUID(tenant)
                        current_tenant_id.set(uuid_tenant)
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

    # TODO: Validate token with Clerk SDK or JWT verification
    # For now, decode the JWT payload to extract user info
    parts = token.split(".")
    if len(parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    import base64
    import json

    payload = parts[1]
    payload += "=" * (4 - len(payload) % 4)
    try:
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        user_id = decoded.get("sub") or decoded.get("oid")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user identifier",
            )
        return {
            "user_id": user_id,
            "email": decoded.get("email"),
            "tenant_id": decoded.get("tenant_id"),
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to decode token",
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
