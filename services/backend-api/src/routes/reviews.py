"""Review endpoints — storefront submission + admin moderation."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.review import ProductReview
from src.orm.schemas.review import ProductReviewCreate, ProductReviewResponse
from src.services.review_service import (
    approve_review,
    create_review,
    increment_helpful,
    reject_review,
)

router = APIRouter(tags=["reviews"])


# ── Storefront ────────────────────────────────────────────────────────


@router.get("/storefront/{tenant_slug}/products/{product_id}/reviews", response_model=list[ProductReviewResponse])
async def list_product_reviews(
    tenant_slug: str,
    product_id: UUID,
    sort: str = Query(default="newest"),
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)

    stmt = (
        select(ProductReview)
        .where(
            ProductReview.tenant_id == tenant.tenant_id,
            ProductReview.product_id == product_id,
            ProductReview.status == "APPROVED",
        )
    )

    if sort == "highest":
        stmt = stmt.order_by(ProductReview.rating.desc(), ProductReview.created_at.desc())
    elif sort == "helpful":
        stmt = stmt.order_by(ProductReview.helpful_count.desc(), ProductReview.created_at.desc())
    else:
        stmt = stmt.order_by(ProductReview.created_at.desc())

    result = await db.exec(stmt)
    return [ProductReviewResponse.model_validate(r) for r in result.all()]


@router.post("/storefront/{tenant_slug}/products/{product_id}/reviews", response_model=ProductReviewResponse, status_code=201)
async def submit_review(
    tenant_slug: str,
    product_id: UUID,
    body: ProductReviewCreate,
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)
    review = await create_review(
        db=db,
        tenant_id=tenant.tenant_id,
        product_id=product_id,
        rating=body.rating,
        title=body.title,
        body=body.body,
        reviewer_name=body.reviewer_name,
        customer_email=body.customer_email,
    )
    await db.commit()
    await db.refresh(review)
    return ProductReviewResponse.model_validate(review)


# ── Admin Moderation ──────────────────────────────────────────────────


@router.get("/admin/reviews", response_model=list[ProductReviewResponse])
async def list_all_reviews(
    status: str = Query(default="PENDING"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    result = await db.exec(
        select(ProductReview)
        .where(
            ProductReview.tenant_id == tenant_id,
            ProductReview.status == status,
        )
        .order_by(ProductReview.created_at.desc())
    )
    return [ProductReviewResponse.model_validate(r) for r in result.all()]


@router.put("/admin/reviews/{review_id}/status", response_model=ProductReviewResponse)
async def moderate_review(
    review_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    action = body.get("status")
    if action == "APPROVED":
        review = await approve_review(db, review_id, tenant_id)
    elif action == "REJECTED":
        review = await reject_review(db, review_id, tenant_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid status")

    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    await db.commit()
    await db.refresh(review)
    return ProductReviewResponse.model_validate(review)


@router.post("/admin/reviews/{review_id}/helpful", response_model=dict)
async def mark_helpful(
    review_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    ok = await increment_helpful(db, review_id, tenant_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Review not found")
    await db.commit()
    return {"status": "ok"}
