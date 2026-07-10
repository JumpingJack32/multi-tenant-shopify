from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Order, OrderItem, OrderStatus
from src.orm.models.product import Variant
from src.orm.schemas.order import OrderCreate, OrderResponse, OrderUpdate
from src.services.fulfillment_router import route_fulfillment

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order).options(selectinload(Order.items)).where(Order.tenant_id == tenant_id)
    result = await db.exec(stmt)
    orders = result.all()
    return orders


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
    stmt = select(Order).options(selectinload(Order.items)).where(Order.id == order_id, Order.tenant_id == tenant_id)
    result = await db.exec(stmt)
    order = result.one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: UUID,
    data: OrderUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    result = await db.exec(stmt)
    order = result.one_or_none()

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
    return order
