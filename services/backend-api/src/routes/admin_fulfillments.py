from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.fulfillment import Fulfillment
from src.orm.schemas.fulfillment import FulfillmentCreate, FulfillmentResponse, TrackingUpdate
from src.services.fulfillment_service import FulfillmentService

router = APIRouter(tags=["admin"])


@router.post("/admin/orders/{order_id}/fulfillments", response_model=FulfillmentResponse, status_code=201)
async def create_fulfillment(
    order_id: UUID,
    body: FulfillmentCreate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events

    svc = FulfillmentService(db)
    staged = []
    fulfillment = await svc.create_fulfillment(
        tenant_id=tenant_id,
        order_id=order_id,
        items_to_pack=[i.model_dump() for i in body.items_to_pack],
        carrier=body.carrier,
        tracking_number=body.tracking_number,
    )
    await db.flush()
    await flush_events(staged)
    await db.refresh(fulfillment)
    return fulfillment


@router.get("/admin/orders/{order_id}/fulfillments", response_model=list[FulfillmentResponse])
async def list_fulfillments(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Fulfillment)
        .options(selectinload(Fulfillment.items))
        .where(Fulfillment.order_id == order_id, Fulfillment.tenant_id == tenant_id)
        .order_by(Fulfillment.created_at.desc())
    )
    fulfillments = (await db.exec(stmt)).all()
    return [FulfillmentResponse.model_validate(f) for f in fulfillments]


@router.patch("/admin/fulfillments/{fulfillment_id}/tracking", response_model=FulfillmentResponse)
async def update_fulfillment_tracking(
    fulfillment_id: UUID,
    body: TrackingUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events

    svc = FulfillmentService(db)
    staged = []
    fulfillment = await svc.update_tracking(
        tenant_id=tenant_id,
        fulfillment_id=fulfillment_id,
        carrier=body.carrier,
        tracking_number=body.tracking_number,
        status=body.status,
        staged=staged,
    )
    await db.flush()
    await flush_events(staged)
    await db.refresh(fulfillment)
    return fulfillment


@router.post("/admin/fulfillments/{fulfillment_id}/cancel", response_model=FulfillmentResponse)
async def cancel_fulfillment(
    fulfillment_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    svc = FulfillmentService(db)
    fulfillment = await svc.cancel_fulfillment(tenant_id=tenant_id, fulfillment_id=fulfillment_id)
    await db.flush()
    await db.refresh(fulfillment)
    return fulfillment
