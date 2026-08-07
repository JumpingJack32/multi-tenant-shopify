"""Public storefront endpoints — no auth or tenant header required."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.core.tenant_isolation import set_tenant_context
from src.dependencies import get_current_user, get_db
from src.orm.models.cart import Cart
from src.orm.models.category import Category
from src.orm.models.collection import Collection
from src.orm.models.product import Product
from src.orm.models.saas_plan import SaaSPlan
from src.orm.models.tenant import Tenant
from src.orm.schemas.category import CategoryResponse
from src.orm.schemas.collection import CollectionResponse
from src.orm.schemas.product import ProductResponse
from src.orm.schemas.saas_plan import SaaSPlanResponse
from src.orm.schemas.signup import (
    SignupRequest,
    SignupResponse,
    SlugCheckRequest,
    SlugCheckResponse,
)
from src.orm.schemas.tenant import TenantPublicResponse
from src.services.abandoned_cart import verify_unsubscribe_token
from src.services.saas_service import check_slug_available, signup_tenant

router = APIRouter()


@router.get("/plans", response_model=list[SaaSPlanResponse])
async def list_plans(
    db: AsyncSession = Depends(get_db),
):
    """List all public SaaS pricing plans."""
    stmt = (
        select(SaaSPlan)
        .where(SaaSPlan.is_public == True)  # noqa: E712
        .order_by(SaaSPlan.sort_order)
    )
    result = await db.exec(stmt)
    return result.all()


@router.post("/tenants/check-slug", response_model=SlugCheckResponse)
async def check_tenant_slug(
    body: SlugCheckRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check if a tenant subdomain slug is available."""
    available = await check_slug_available(body.slug, db)
    return SlugCheckResponse(available=available)


@router.post("/tenants", response_model=SignupResponse, status_code=201)
async def create_tenant_signup(
    body: SignupRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-serve tenant sign-up with plan selection and Stripe billing setup."""
    # Validate slug availability
    if not await check_slug_available(body.slug, db):
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug '{body.slug}' is already taken",
        )

    try:
        result = await signup_tenant(
            name=body.name,
            slug=body.slug,
            plan_slug=body.plan_slug,
            clerk_user_id=user["user_id"],
            email=user.get("email", ""),
            stripe_payment_method_id=body.stripe_payment_method_id,
            db=db,
        )
    except ValueError as e:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return SignupResponse(
        tenant_id=result["tenant_id"],
        slug=result["slug"],
        name=result["name"],
        admin_url=result["admin_url"],
        trial_ends_at=result["trial_ends_at"],
    )


@router.get("/tenants/{slug}", response_model=TenantPublicResponse)
async def resolve_tenant(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a tenant by slug — used by the storefront to discover tenant info."""
    stmt = select(Tenant).where(Tenant.slug == slug, Tenant.status == "ACTIVE")
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
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List active products for a tenant — public storefront browsing."""
    # Resolve tenant by slug
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
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
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(
            Product.tenant_id == tenant.tenant_id,
            Product.is_active == True,  # noqa: E712
        )
    )

    if category:
        stmt = stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category,
            Category.is_active == True,  # noqa: E712
        )

    stmt = stmt.order_by(Product.created_at.desc())
    result = await db.exec(stmt)
    products = result.all()
    return products


@router.get("/categories/{tenant_slug}", response_model=list[CategoryResponse])
async def public_categories(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """List active categories for a tenant — public storefront browsing."""
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    stmt = (
        select(Category)
        .where(
            Category.tenant_id == tenant.tenant_id,
            Category.is_active == True,  # noqa: E712
        )
        .order_by(Category.sort_order, Category.name)
    )
    categories = (await db.exec(stmt)).all()
    result = []
    for cat in categories:
        count_stmt = select(func.count()).select_from(Product).where(
            Product.category_id == cat.id,
            Product.tenant_id == tenant.tenant_id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CategoryResponse(
            **cat.model_dump(),
            product_count=count,
        ))
    return result


@router.get("/collections/{tenant_slug}", response_model=list[CollectionResponse])
async def public_collections(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """List active collections for a tenant — public storefront browsing."""
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    stmt = (
        select(Collection)
        .options(selectinload(Collection.products))
        .where(
            Collection.tenant_id == tenant.tenant_id,
            Collection.is_active == True,  # noqa: E712
        )
        .order_by(Collection.sort_order, Collection.name)
    )
    collections = (await db.exec(stmt)).all()
    result = []
    for col in collections:
        result.append(CollectionResponse(
            **col.model_dump(),
            product_count=len(col.products),
        ))
    return result


@router.post("/carts/unsubscribe/{token}")
async def unsubscribe_cart_recovery(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribe from abandoned cart emails via signed token."""
    try:
        payload = verify_unsubscribe_token(token, settings.jwt_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe token")

    cart = await db.get(Cart, payload["cart_id"])
    if cart and cart.email == payload["email"]:
        cart.unsubscribed = True
        await db.commit()

    return {"ok": True}
