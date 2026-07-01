from uuid import UUID

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from src.dependencies import current_tenant_id

from src.core.clerk_jwks import verify_clerk_token


PUBLIC_PATHS = {"/health", "/api/v1/public"}


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Public routes skip tenant enforcement
        if any(path == p or path.startswith(f"{p}/") for p in PUBLIC_PATHS):
            return await call_next(request)

        raw_tenant_id: str | None = request.headers.get("x-tenant-id")

        if not raw_tenant_id:
            authorization = request.headers.get("authorization")
            if authorization and authorization.startswith("Bearer "):
                token = authorization[7:]
                try:
                    claims = await verify_clerk_token(token)
                    raw_tenant_id = claims.get("tenant_id")
                except Exception:
                    pass

        if raw_tenant_id:
            try:
                tenant_id = UUID(raw_tenant_id)
                current_tenant_id.set(tenant_id)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid tenant ID format",
                )
        else:
            raise HTTPException(
                status_code=400,
                detail="Missing tenant context in request",
            )

        response = await call_next(request)
        response.headers["X-Tenant-ID"] = str(tenant_id)
        return response
