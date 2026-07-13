from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Order, OrderItem
from src.orm.models.purchase_order import (
    OrderFulfillmentLink,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from src.orm.schemas.purchase_order import (
    PaginationMeta,
    PurchaseOrderListResponse,
    PurchaseOrderPatchInput,
    PurchaseOrderItemResponse,
    PurchaseOrderResponse,
)
from src.services.po_state_machine import validate_transition

router = APIRouter(tags=["purchase_orders"])


async def _build_po_response(db: AsyncSession, po: PurchaseOrder) -> PurchaseOrderResponse:
    sup_stmt = select(Supplier).where(Supplier.id == po.supplier_id)
    sup_result = await db.exec(sup_stmt)
    supplier = sup_result.first()
    supplier_name = supplier.name if supplier else "Unknown"

    items_stmt = (
        select(PurchaseOrderItem)
        .where(PurchaseOrderItem.purchase_order_id == po.id)
    )
    items_result = await db.exec(items_stmt)
    items = items_result.all()

    item_responses = [
        PurchaseOrderItemResponse.model_validate(item) for item in items
    ]

    source_order_number = None
    if items:
        link_stmt = (
            select(OrderFulfillmentLink)
            .where(
                OrderFulfillmentLink.purchase_order_item_id.in_([i.id for i in items]),
            )
            .limit(1)
        )
        link_result = await db.exec(link_stmt)
        link = link_result.first()
        if link:
            oi_stmt = select(OrderItem).where(OrderItem.id == link.order_item_id)
            oi_result = await db.exec(oi_stmt)
            order_item = oi_result.first()
            if order_item:
                o_stmt = select(Order).where(Order.id == order_item.order_id)
                o_result = await db.exec(o_stmt)
                order = o_result.first()
                if order:
                    source_order_number = order.order_number

    ship_to_address = None
    if po.ship_to_address_snapshot:
        ship_to_address = po.ship_to_address_snapshot

    return PurchaseOrderResponse(
        id=po.id,
        tenant_id=po.tenant_id,
        po_number=po.po_number,
        supplier_id=po.supplier_id,
        supplier_name=supplier_name,
        status=po.status,
        fulfillment_strategy=po.fulfillment_strategy,
        ship_to_address=ship_to_address,
        tracking_number=po.tracking_number,
        carrier=po.carrier,
        subtotal=po.subtotal,
        tax=po.tax,
        shipping_cost=po.shipping_cost,
        total=po.total,
        source_order_number=source_order_number,
        items=item_responses,
        notes=po.notes,
        created_at=po.created_at,
        updated_at=po.updated_at,
        sent_at=po.sent_at,
        confirmed_at=po.confirmed_at,
        closed_at=po.closed_at,
    )


@router.get("/purchase-orders", response_model=PurchaseOrderListResponse)
async def list_purchase_orders(
    status_filter: str | None = Query(None, alias="status"),
    supplier_id: UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(PurchaseOrder.id)).where(
        PurchaseOrder.tenant_id == tenant_id,
    )
    query_stmt = (
        select(PurchaseOrder)
        .where(PurchaseOrder.tenant_id == tenant_id)
        .order_by(PurchaseOrder.created_at.desc())
    )

    if status_filter:
        count_stmt = count_stmt.where(PurchaseOrder.status == status_filter)
        query_stmt = query_stmt.where(PurchaseOrder.status == status_filter)
    if supplier_id:
        count_stmt = count_stmt.where(PurchaseOrder.supplier_id == supplier_id)
        query_stmt = query_stmt.where(PurchaseOrder.supplier_id == supplier_id)

    result = await db.exec(count_stmt)
    total = result.one()

    query_stmt = query_stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.exec(query_stmt)
    pos = result.all()

    items = [await _build_po_response(db, po) for po in pos]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return PurchaseOrderListResponse(
        data=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/purchase-orders/pending", response_model=PurchaseOrderListResponse)
async def list_pending_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(PurchaseOrder.id)).where(
        PurchaseOrder.tenant_id == tenant_id,
        PurchaseOrder.status.in_(["draft", "pending_review"]),
    )
    result = await db.exec(count_stmt)
    total = result.one()

    query_stmt = (
        select(PurchaseOrder)
        .where(
            PurchaseOrder.tenant_id == tenant_id,
            PurchaseOrder.status.in_(["draft", "pending_review"]),
        )
        .order_by(PurchaseOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.exec(query_stmt)
    pos = result.all()

    items = [await _build_po_response(db, po) for po in pos]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return PurchaseOrderListResponse(
        data=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    po_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.id == po_id,
        PurchaseOrder.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    po = result.one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    return await _build_po_response(db, po)


@router.patch("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_id: UUID,
    data: PurchaseOrderPatchInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.id == po_id,
        PurchaseOrder.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    po = result.one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data:
        validate_transition(po.status, update_data["status"], po.fulfillment_strategy)
        po.status = update_data["status"]
        if update_data["status"] == "sent":
            from datetime import UTC, datetime
            po.sent_at = datetime.now(UTC)
        elif update_data["status"] == "confirmed":
            from datetime import UTC, datetime
            po.confirmed_at = datetime.now(UTC)
        elif update_data["status"] == "closed":
            from datetime import UTC, datetime
            po.closed_at = datetime.now(UTC)

    for key in {"tracking_number", "carrier", "notes"} & update_data.keys():
        setattr(po, key, update_data[key])

    await db.flush()
    return await _build_po_response(db, po)


@router.post("/purchase-orders/{po_id}/approve", response_model=PurchaseOrderResponse)
async def approve_purchase_order(
    po_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.id == po_id,
        PurchaseOrder.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    po = result.one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    validate_transition(po.status, "sent", po.fulfillment_strategy)
    po.status = "sent"
    from datetime import UTC, datetime
    po.sent_at = datetime.now(UTC)
    await db.flush()
    return await _build_po_response(db, po)


@router.post("/purchase-orders/{po_id}/cancel", response_model=PurchaseOrderResponse)
async def cancel_purchase_order(
    po_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PurchaseOrder).where(
        PurchaseOrder.id == po_id,
        PurchaseOrder.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    po = result.one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    validate_transition(po.status, "cancelled", po.fulfillment_strategy)
    po.status = "cancelled"
    await db.flush()
    return await _build_po_response(db, po)
