"""Admin subscription endpoints — metrics, subscriber list, status management."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.subscription import CustomerSubscription
from src.orm.schemas.subscription import CustomerSubscriptionResponse
from src.services.subscription_analytics_service import (
    get_subscription_metrics,
    list_subscriptions,
)

router = APIRouter(tags=["admin-subscriptions"])


@router.get("/admin/subscriptions/metrics")
async def subscription_metrics(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    return await get_subscription_metrics(db, tenant_id)


@router.get("/admin/subscriptions/list", response_model=list[CustomerSubscriptionResponse])
async def subscription_list(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    return await list_subscriptions(db, tenant_id)


@router.put("/admin/subscriptions/{sub_id}/status")
async def update_subscription_status(
    sub_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    sub = (
        await db.exec(
            select(CustomerSubscription).where(
                CustomerSubscription.id == sub_id,
                CustomerSubscription.tenant_id == tenant_id,
            )
        )
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    new_status = body.get("status")
    if new_status not in ("active", "paused", "canceled"):
        raise HTTPException(status_code=400, detail="Invalid status")

    sub.status = new_status
    db.add(sub)
    await db.commit()
    return {"status": "ok"}
