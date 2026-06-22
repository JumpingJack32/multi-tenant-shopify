from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from src.dependencies import current_tenant_id

from src.core.clerk_jwks import verify_clerk_token


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tenant_id = request.headers.get("x-tenant-id")

        if not tenant_id:
            authorization = request.headers.get("authorization")
            if authorization and authorization.startswith("Bearer "):
                token = authorization[7:]
                try:
                    claims = await verify_clerk_token(token)
                    tenant_id = claims.get("tenant_id") or claims.get("sub")
                except Exception:
                    pass

        if tenant_id:
            current_tenant_id.set(tenant_id)
        else:
            raise HTTPException(
                status_code=400,
                detail="Missing tenant context in request",
            )

        response = await call_next(request)
        response.headers["X-Tenant-ID"] = tenant_id
        return response
