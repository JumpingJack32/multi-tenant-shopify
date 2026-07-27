from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.fulfillment import Fulfillment
from src.orm.models.order import Order
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
    if body.tracking_url:
        fulfillment.tracking_url = body.tracking_url
        db.add(fulfillment)
    await db.flush()
    await flush_events(staged)
    await db.refresh(fulfillment)

    # Deduct inventory from the specified node
    if body.node_id and body.items_to_pack:
        from src.services.inventory_service import deduct as deduct_stock

        order = (
            await db.exec(
                select(Order)
                .options(selectinload(Order.items))
                .where(Order.id == order_id, Order.tenant_id == tenant_id)
            )
        ).one_or_none()
        if order:
            for fi in body.items_to_pack:
                oi = next((i for i in (order.items or []) if i.id == fi.order_item_id), None)
                if oi and oi.variant_id:
                    try:
                        await deduct_stock(db, oi.variant_id, body.node_id, fi.quantity)
                    except Exception:
                        pass  # non-blocking: fulfillment already created

    # Send shipping notification in background
    if body.notify_customer:
        from src.orm.models.tenant import Tenant
        from src.services.email_service import create_email_service

        order = (
            await db.exec(
                select(Order)
                .options(selectinload(Order.items))
                .where(Order.id == order_id, Order.tenant_id == tenant_id)
            )
        ).one_or_none()
        tenant = (
            await db.exec(select(Tenant).where(Tenant.tenant_id == tenant_id))
        ).one_or_none()

        if order and order.customer_email:
            import asyncio

            email_svc = create_email_service()
            await db.refresh(fulfillment, ["items"])
            asyncio.create_task(
                email_svc.send_shipping_notification(
                    to_email=order.customer_email,
                    order={
                        "order_number": order.order_number,
                    },
                    fulfillment={
                        "carrier": body.carrier or "",
                        "tracking_number": body.tracking_number or "",
                        "tracking_url": body.tracking_url or "",
                        "items": [
                            {
                                "product_name": oi.product_name,
                                "quantity": fi.quantity,
                            }
                            for oi in (order.items or [])
                            for fi in (fulfillment.items or [])
                            if fi.order_item_id == oi.id
                        ],
                    },
                    tenant_name=tenant.name if tenant and tenant.name else tenant.slug if tenant else "",
                )
            )

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
