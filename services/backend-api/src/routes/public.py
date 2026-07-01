"""Public storefront endpoints — no auth or tenant header required."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.tenant_isolation import set_tenant_context
from src.dependencies import get_db
from src.orm.models.product import Product
from src.orm.models.tenant import Tenant
from src.orm.schemas.product import ProductResponse
from src.orm.schemas.tenant import TenantPublicResponse

router = APIRouter()


@router.get("/tenants/{slug}", response_model=TenantPublicResponse)
async def resolve_tenant(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a tenant by slug — used by the storefront to discover tenant info."""
    stmt = select(Tenant).where(Tenant.slug == slug, Tenant.status == "active")
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    return tenant


@router.get("/products/{tenant_slug}", response_model=list[ProductResponse])
async def public_products(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """List active products for a tenant — public storefront browsing."""
    # Resolve tenant by slug
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "active")
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    # Set tenant context for isolation filters
    set_tenant_context(tenant.tenant_id)

    # Fetch active products scoped to this tenant
    stmt = select(Product).where(
        Product.tenant_id == tenant.tenant_id,
        Product.is_active == True,  # noqa: E712
    )
    result = await db.exec(stmt)
    products = result.all()
    return products
