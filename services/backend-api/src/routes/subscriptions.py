"""Subscription endpoints — plan listing, customer subscription management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.subscription import CustomerSubscription, SubscriptionPlan
from src.orm.schemas.subscription import (
    CustomerSubscriptionResponse,
    SubscriptionPlanResponse,
)

router = APIRouter(tags=["subscriptions"])


@router.get("/storefront/{tenant_slug}/products/{product_id}/subscription-plans", response_model=list[SubscriptionPlanResponse])
async def list_subscription_plans(
    tenant_slug: str,
    product_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)
    result = await db.exec(
        select(SubscriptionPlan).where(
            SubscriptionPlan.tenant_id == tenant.tenant_id,
            SubscriptionPlan.product_id == product_id,
            SubscriptionPlan.is_active == True,
        )
    )
    return [SubscriptionPlanResponse.model_validate(p) for p in result.all()]


@router.get("/storefront/{tenant_slug}/subscriptions", response_model=list[CustomerSubscriptionResponse])
async def list_customer_subscriptions(
    tenant_slug: str,
    customer_email: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)
    result = await db.exec(
        select(CustomerSubscription).where(
            CustomerSubscription.tenant_id == tenant.tenant_id,
            CustomerSubscription.customer_email == customer_email,
        ).order_by(CustomerSubscription.created_at.desc())
    )
    return [CustomerSubscriptionResponse.model_validate(s) for s in result.all()]


@router.post("/storefront/{tenant_slug}/subscriptions/{sub_id}/cancel")
async def cancel_subscription(
    tenant_slug: str,
    sub_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    from src.routes.storefront import _resolve_tenant

    tenant = await _resolve_tenant(db, tenant_slug)
    sub = (
        await db.exec(
            select(CustomerSubscription).where(
                CustomerSubscription.id == sub_id,
                CustomerSubscription.tenant_id == tenant.tenant_id,
                CustomerSubscription.status == "active",
            )
        )
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Active subscription not found")

    sub.status = "canceled"
    db.add(sub)
    await db.commit()
    return {"status": "ok"}
