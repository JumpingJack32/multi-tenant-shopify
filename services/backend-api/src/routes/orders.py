from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from src.dependencies import get_current_tenant_id
from src.orm.models.order import Order, OrderItem
from src.orm.schemas.order import OrderCreate, OrderUpdate, OrderResponse

router = APIRouter()


@router.get("/", response_model=list[OrderResponse])
async def list_orders(
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    stmt = select(Order).where(Order.tenant_id == tenant_id)
    results = db.exec(stmt).all()
    return results


@router.post("/", response_model=OrderResponse)
async def create_order(
    data: OrderCreate,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    order = Order(customer_email=data.customer_email, tenant_id=tenant_id)
    db.add(order)
    db.flush()

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
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order or order.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.put("/{order_id}", response_model=OrderResponse)
async def update_order(
    order_id: str,
    data: OrderUpdate,
    tenant_id: str = Depends(get_current_tenant_id),
    db: Session = Depends(get_db),
):
    order = db.get(Order, order_id)
    if not order or order.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Order not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(order, key, value)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
