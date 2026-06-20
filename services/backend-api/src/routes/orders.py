from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Order, OrderItem
from src.orm.schemas.order import OrderCreate, OrderResponse, OrderUpdate

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order).where(Order.tenant_id == tenant_id)
    result = await db.execute(stmt)
    orders = result.scalars().all()
    return orders


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    data: OrderCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    order = Order(customer_email=data.customer_email, tenant_id=tenant_id)
    db.add(order)
    await db.flush()

    total = 0
    for item in data.items:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item["product_id"],
            tenant_id=tenant_id,
            quantity=item["quantity"],
            unit_price=item["unit_price"],
        )
        db.add(order_item)
        total += item["quantity"] * item["unit_price"]

    order.total = total
    await db.flush()
    await db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id)
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

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
    result = await db.execute(stmt)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(order, key, value)

    await db.flush()
    await db.refresh(order)
    return order
