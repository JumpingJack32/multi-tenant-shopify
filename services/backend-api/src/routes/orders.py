from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import joinedload, selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Customer, Order, OrderItem, OrderStatus
from src.orm.models.product import Variant
from src.orm.models.purchase_order import OrderFulfillmentLink, PurchaseOrder, PurchaseOrderItem, Supplier
from src.orm.schemas.common import PaginatedResponse, PaginationMeta
from src.orm.schemas.order import OrderCreate, OrderItemResponse, OrderResponse, OrderUpdate
from src.orm.schemas.purchase_order import AssociatedPOResponse
from src.services.fulfillment_router import route_fulfillment
from src.services.order_state_machine import OrderStateError, validate_transition

router = APIRouter()


SORT_FIELDS: dict[str, str] = {
    "created_at": "created_at",
    "order_number": "order_number",
    "total": "total",
    "status": "status",
}


@router.get("/", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
    customer_id: Optional[str] = Query(None),
    created_after: Optional[str] = Query(None),
    created_before: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    from sqlalchemy import func

    base = select(Order).where(Order.tenant_id == tenant_id)

    if status:
        base = base.where(Order.status == status)
    if payment_status:
        base = base.where(Order.payment_status == payment_status)
    if customer_id:
        try:
            base = base.where(Order.customer_id == UUID(customer_id))
        except ValueError:
            pass
    if created_after:
        try:
            from datetime import datetime

            base = base.where(Order.created_at >= datetime.fromisoformat(created_after))
        except ValueError:
            pass
    if created_before:
        try:
            from datetime import datetime

            base = base.where(Order.created_at <= datetime.fromisoformat(created_before))
        except ValueError:
            pass
    if search:
        base = base.where(
            Order.order_number.ilike(f"%{search}%")
            | Order.customer.has(Customer.email.ilike(f"%{search}%"))
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total_result = await db.exec(count_stmt)
    total = total_result.one()

    order_col = SORT_FIELDS.get(sort_by, "created_at")
    order_dir = getattr(Order, order_col).desc() if sort_order != "asc" else getattr(Order, order_col).asc()

    stmt = (
        base.options(joinedload(Order.customer), selectinload(Order.items))
        .order_by(order_dir)
    )
    result = await db.exec(stmt.offset((page - 1) * page_size).limit(page_size))
    orders = result.unique().all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return PaginatedResponse(
        data=[
            OrderResponse(
                **order.model_dump(),
                customer_email=order.customer.email if order.customer else None,
                items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
            )
            for order in orders
        ],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    order_number = data.order_number or f"SO-{uuid.uuid4().hex[:8].upper()}"

    order = Order(
        order_number=order_number,
        tenant_id=tenant_id,
        status=data.status or OrderStatus.PENDING.value,
        subtotal=data.subtotal,
        total=data.total,
        shipping_address=data.shipping_address or {},
        billing_address=data.billing_address or {},
        notes=data.notes,
        currency=data.currency,
    )
    if data.customer_id:
        order.customer_id = data.customer_id
    db.add(order)
    await db.flush()

    for item in data.items:
        variant_id = None
        product_id = None
        if item.variant_id:
            variant_id = item.variant_id
            v_stmt = select(Variant).where(Variant.id == item.variant_id)
            v_result = await db.exec(v_stmt)
            variant = v_result.first()
            if variant:
                product_id = variant.product_id

        order_item = OrderItem(
            order_id=order.id,
            variant_id=variant_id,
            product_id=product_id or item.product_id,
            product_name=item.product_name or "",
            sku=item.sku or "",
            tenant_id=tenant_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.total_price or (item.quantity * item.unit_price),
            discount=item.discount,
        )
        db.add(order_item)
        await db.flush()

        # Auto-generate PO for paid orders with known variants
        if data.status == OrderStatus.PAID.value and variant_id:
            v_stmt = select(Variant).where(Variant.id == variant_id)
            v_result = await db.exec(v_stmt)
            variant = v_result.first()
            if variant:
                await route_fulfillment(order_item, variant, tenant_id, db)

    await db.refresh(order, ["items"])
    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Order)
        .options(joinedload(Order.customer), selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    order = result.unique().one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return OrderResponse(
        **order.model_dump(),
        customer_email=order.customer.email if order.customer else None,
        items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
    )


@router.get("/{order_id}/purchase-orders", response_model=list[AssociatedPOResponse])
async def get_order_purchase_orders(
    order_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all purchase orders linked to a given sales order."""
    # Find order_items for this order
    oi_stmt = select(OrderItem.id).where(
        OrderItem.order_id == order_id,
        OrderItem.tenant_id == tenant_id,
    )
    oi_result = await db.exec(oi_stmt)
    order_item_ids = [row for row in oi_result]

    if not order_item_ids:
        return []

    # Find fulfillment links from those order items
    link_stmt = (
        select(OrderFulfillmentLink.purchase_order_item_id)
        .where(OrderFulfillmentLink.order_item_id.in_(order_item_ids))
    )
    link_result = await db.exec(link_stmt)
    poi_ids = set(row for row in link_result)

    if not poi_ids:
        return []

    # Find POs from PO items
    po_stmt = (
        select(PurchaseOrder)
        .join(PurchaseOrderItem)
        .where(
            PurchaseOrderItem.id.in_(list(poi_ids)),
            PurchaseOrder.tenant_id == tenant_id,
        )
        .distinct(PurchaseOrder.id)
    )
    po_result = await db.exec(po_stmt)
    pos = po_result.all()

    # Attach supplier names
    result = []
    for po in pos:
        sup_stmt = select(Supplier).where(Supplier.id == po.supplier_id)
        sup_result = await db.exec(sup_stmt)
        supplier = sup_result.first()
        result.append(AssociatedPOResponse(
            id=po.id,
            po_number=po.po_number,
            status=po.status,
            supplier_name=supplier.name if supplier else "Unknown",
            total=po.total,
            fulfillment_strategy=po.fulfillment_strategy,
            created_at=po.created_at,
        ))

    return result


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: UUID,
    data: OrderUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Order)
        .options(joinedload(Order.customer))
        .where(Order.id == order_id, Order.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    order = result.unique().one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    old_status = order.status
    update_data = data.model_dump(exclude_unset=True)

    # Validate status transition
    if "status" in update_data and update_data["status"] != old_status:
        try:
            validate_transition(old_status, update_data["status"])
        except OrderStateError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.message,
            )

    for key, value in update_data.items():
        setattr(order, key, value)

    # Auto-generate POs when status transitions to paid
    if "status" in update_data and update_data["status"] == OrderStatus.PAID.value and old_status != OrderStatus.PAID.value:
        items_stmt = select(OrderItem).where(OrderItem.order_id == order.id)
        items_result = await db.exec(items_stmt)
        for order_item in items_result.all():
            if order_item.variant_id:
                v_stmt = select(Variant).where(Variant.id == order_item.variant_id)
                v_result = await db.exec(v_stmt)
                variant = v_result.first()
                if variant:
                    await route_fulfillment(order_item, variant, tenant_id, db)

    await db.flush()
    await db.refresh(order, ["items"])
    return OrderResponse(
        **order.model_dump(),
        customer_email=order.customer.email if order.customer else None,
        items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
    )


@router.patch("/{order_id}", response_model=OrderResponse)
async def patch_order(
    order_id: UUID,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    return await update_order(order_id, order_data, tenant_id, db)


# ── Lifecycle Transitions ────────────────────────────────────────────


@router.post("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.confirm(order_id, tenant_id, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/pay", response_model=OrderResponse)
async def pay_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.mark_paid(order_id, tenant_id, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/ship", response_model=OrderResponse)
async def ship_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.ship(order_id, tenant_id, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/deliver", response_model=OrderResponse)
async def deliver_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.deliver(order_id, tenant_id, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.cancel(order_id, tenant_id, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/refund", response_model=OrderResponse)
async def refund_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.services.event_publisher import flush as flush_events
    from src.services.order_lifecycle import OrderLifecycleService

    svc = OrderLifecycleService(db)
    staged = []
    try:
        order = await svc.refund(order_id, tenant_id, True, staged)
        await db.flush()
        await flush_events(staged)
        await db.refresh(order)
        return order
    except Exception as e:
        from fastapi import status
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.post("/{order_id}/recalculate-tax", response_model=OrderResponse)
async def recalculate_order_tax(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    from src.orm.models.order import OrderItem
    from src.orm.models.tenant import TenantTaxConfig
    from src.services.tax_service import calculate_tax

    stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    order = (await db.exec(stmt)).one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    tax_stmt = select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
    tax_config = (await db.exec(tax_stmt)).one_or_none()
    if not tax_config or not tax_config.enabled:
        raise HTTPException(status_code=422, detail="Tax not configured for this tenant")

    items_stmt = select(OrderItem).where(OrderItem.order_id == order_id)
    items = (await db.exec(items_stmt)).all()

    for item in items:
        tax, _ = calculate_tax(item.total_price, tax_config.default_rate, tax_config.tax_inclusive)
        item.tax_rate = tax_config.default_rate
        item.tax_amount = tax
        db.add(item)

    await db.flush()
    await db.refresh(order)
    return order
