from contextvars import ContextVar
from fastapi import Header, HTTPException

current_tenant_id: ContextVar[str] = ContextVar("current_tenant_id", default="")


async def get_current_tenant_id(
    x_tenant_id: str | None = Header(None, alias="X-Tenant-ID"),
    authorization: str | None = Header(None),
) -> str:
    if x_tenant_id:
        current_tenant_id.set(x_tenant_id)
        return x_tenant_id

    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        # Parse Clerk token to extract tenant_id
        parts = token.split(".")
        if len(parts) >= 2:
            import base64
            import json

            payload = parts[1]
            # Add padding if needed
            payload += "=" * (4 - len(payload) % 4)
            try:
                decoded = json.loads(base64.urlsafe_b64decode(payload))
                tenant = decoded.get("tenant_id") or decoded.get("sub")
                if tenant:
                    current_tenant_id.set(tenant)
                    return tenant
            except Exception:
                pass

    raise HTTPException(
        status_code=401,
        detail="Missing or invalid tenant context",
    )


def get_db():
    """Yield a database session scoped to the current tenant."""
    from sqlmodel import Session

    session = Session.__new__(Session)
    yield session
