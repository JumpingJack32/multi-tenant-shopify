from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlmodel import func, select

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Customer, CustomerAddress, Order
from src.orm.schemas.customer import (
    CustomerAddressResponse,
    CustomerDetailResponse,
    CustomerOrderResponse,
    CustomerResponse,
)

router = APIRouter(tags=["customers"])


@router.get("/customers/")
async def list_customers(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
):
    stmt = select(Customer).where(Customer.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id)

    if search:
        pattern = f"%{search}%"
        filter_clause = (
            Customer.email.ilike(pattern)
            | Customer.first_name.ilike(pattern)
            | Customer.last_name.ilike(pattern)
        )
        stmt = stmt.where(filter_clause)
        count_stmt = count_stmt.where(filter_clause)

    stmt = stmt.order_by(Customer.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

    customers = (await db.exec(stmt)).all()
    total = (await db.exec(count_stmt)).one()

    return {
        "data": [CustomerResponse.model_validate(c) for c in customers],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/customers/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Customer)
        .where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
        .options(selectinload(Customer.addresses), selectinload(Customer.orders))
    )
    customer = (await db.exec(stmt)).one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    aov = customer.total_spent // customer.total_orders if customer.total_orders > 0 else 0

    orders = [
        CustomerOrderResponse(
            id=o.id,
            order_number=o.order_number,
            total=int(o.total * 100),
            status=o.status.value if hasattr(o.status, "value") else o.status,
            created_at=o.created_at,
        )
        for o in customer.orders
    ]

    addresses = [CustomerAddressResponse.model_validate(a) for a in customer.addresses]

    base = CustomerResponse.model_validate(customer)
    return CustomerDetailResponse(
        **base.model_dump(),
        average_order_value=aov,
        addresses=addresses,
        orders=orders,
    )
