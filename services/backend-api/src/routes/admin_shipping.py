"""Admin shipping method CRUD endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.shipping import ShippingMethod
from src.orm.schemas.shipping import (
    CreateShippingMethodRequest,
    ShippingMethodResponse,
    UpdateShippingMethodRequest,
)

router = APIRouter(tags=["admin-shipping"])


@router.get("/admin/shipping-methods", response_model=list[ShippingMethodResponse])
async def list_shipping_methods(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    result = await db.exec(
        select(ShippingMethod).where(ShippingMethod.tenant_id == tenant_id)
    )
    return [ShippingMethodResponse.model_validate(m) for m in result.all()]


@router.post("/admin/shipping-methods", response_model=ShippingMethodResponse, status_code=201)
async def create_shipping_method(
    body: CreateShippingMethodRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    method = ShippingMethod(
        tenant_id=tenant_id,
        name=body.name,
        description=body.description,
        rate_type=body.rate_type,
        base_price=body.base_price,
        free_shipping_threshold=body.free_shipping_threshold,
        is_active=body.is_active,
    )
    db.add(method)
    await db.commit()
    await db.refresh(method)
    return ShippingMethodResponse.model_validate(method)


@router.put("/admin/shipping-methods/{method_id}", response_model=ShippingMethodResponse)
async def update_shipping_method(
    method_id: UUID,
    body: UpdateShippingMethodRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    method = (
        await db.exec(
            select(ShippingMethod).where(
                ShippingMethod.id == method_id,
                ShippingMethod.tenant_id == tenant_id,
            )
        )
    ).first()
    if not method:
        raise HTTPException(status_code=404, detail="Shipping method not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(method, key, val)
    db.add(method)
    await db.commit()
    await db.refresh(method)
    return ShippingMethodResponse.model_validate(method)


@router.delete("/admin/shipping-methods/{method_id}", status_code=204)
async def delete_shipping_method(
    method_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    method = (
        await db.exec(
            select(ShippingMethod).where(
                ShippingMethod.id == method_id,
                ShippingMethod.tenant_id == tenant_id,
            )
        )
    ).first()
    if not method:
        raise HTTPException(status_code=404, detail="Shipping method not found")
    await db.delete(method)
    await db.commit()
