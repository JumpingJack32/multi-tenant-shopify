"""Promotion admin CRUD and storefront validation endpoints."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.promotion import Promotion
from src.orm.schemas.promotion import (
    PromotionCreate,
    PromotionResponse,
    PromotionUpdate,
    ValidatePromotionRequest,
    ValidatePromotionResponse,
)
from src.services.discount_service import increment_uses, validate_promotion

router = APIRouter(tags=["promotions"])


# ── Admin CRUD ────────────────────────────────────────────────────────


@router.get("/admin/promotions", response_model=list[PromotionResponse])
async def list_promotions(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    result = await db.exec(
        select(Promotion)
        .where(Promotion.tenant_id == tenant_id)
        .order_by(Promotion.created_at.desc())
    )
    return [PromotionResponse.model_validate(p) for p in result.all()]


@router.post("/admin/promotions", response_model=PromotionResponse, status_code=201)
async def create_promotion(
    body: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    existing = (
        await db.exec(
            select(Promotion).where(
                Promotion.tenant_id == tenant_id,
                Promotion.code == body.code.strip().upper(),
            )
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A promotion with this code already exists")

    promo = Promotion(
        tenant_id=tenant_id,
        code=body.code.strip().upper(),
        type=body.type,
        value=body.value,
        min_subtotal=body.min_subtotal,
        max_uses=body.max_uses,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        is_active=body.is_active,
    )
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return PromotionResponse.model_validate(promo)


@router.put("/admin/promotions/{promo_id}", response_model=PromotionResponse)
async def update_promotion(
    promo_id: UUID,
    body: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    promo = (
        await db.exec(
            select(Promotion).where(
                Promotion.id == promo_id,
                Promotion.tenant_id == tenant_id,
            )
        )
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        if key == "code":
            val = val.strip().upper()
        setattr(promo, key, val)
    db.add(promo)
    await db.commit()
    await db.refresh(promo)
    return PromotionResponse.model_validate(promo)


@router.delete("/admin/promotions/{promo_id}", status_code=204)
async def deactivate_promotion(
    promo_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    promo = (
        await db.exec(
            select(Promotion).where(
                Promotion.id == promo_id,
                Promotion.tenant_id == tenant_id,
            )
        )
    ).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    promo.is_active = False
    db.add(promo)
    await db.commit()


# ── Storefront Validation ─────────────────────────────────────────────


@router.post("/storefront/{tenant_slug}/promotions/validate", response_model=ValidatePromotionResponse)
async def validate_storefront_promotion(
    tenant_slug: str,
    body: ValidatePromotionRequest,
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)
    return await validate_promotion(db, tenant.tenant_id, body.code, body.subtotal)
