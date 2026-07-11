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
from src.orm.schemas.order import OrderCreate, OrderItemResponse, OrderResponse, OrderUpdate
from src.orm.schemas.purchase_order import AssociatedPOResponse
from src.services.fulfillment_router import route_fulfillment

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None),
    payment_status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = (
        select(Order)
        .options(joinedload(Order.customer), selectinload(Order.items))
        .where(Order.tenant_id == tenant_id)
    )

    if status:
        stmt = stmt.where(Order.status == status)
    if payment_status:
        stmt = stmt.where(Order.payment_status == payment_status)
    if search:
        stmt = stmt.where(
            Order.order_number.ilike(f"%{search}%")
            | Order.customer.has(Customer.email.ilike(f"%{search}%"))
        )

    stmt = stmt.order_by(Order.created_at.desc())
    result = await db.exec(stmt.offset((page - 1) * page_size).limit(page_size))
    orders = result.unique().all()
    return [
        OrderResponse(
            **order.model_dump(),
            customer_email=order.customer.email if order.customer else None,
            items=[OrderItemResponse(**item.model_dump()) for item in (order.items or [])],
        )
        for order in orders
    ]


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
                po_id = await route_fulfillment(order_item, variant, tenant_id, db)

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
