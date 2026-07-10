from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Product
from src.orm.models.purchase_order import PurchaseOrder, Supplier
from src.orm.schemas.purchase_order import (
    PaginationMeta,
    SupplierCreateInput,
    SupplierListResponse,
    SupplierPatchInput,
    SupplierResponse,
)

router = APIRouter(tags=["suppliers"])


@router.get("/suppliers", response_model=SupplierListResponse)
async def list_suppliers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(Supplier.id)).where(Supplier.tenant_id == tenant_id)
    result = await db.exec(count_stmt)
    total = result.one()

    stmt = (
        select(Supplier)
        .where(Supplier.tenant_id == tenant_id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.exec(stmt)
    suppliers = result.all()

    product_counts: dict[UUID, int] = {}
    if suppliers:
        p_stmt = (
            select(Product.supplier_id, func.count(Product.id))
            .where(
                Product.supplier_id.in_([s.id for s in suppliers]),
                Product.tenant_id == tenant_id,
            )
            .group_by(Product.supplier_id)
        )
        p_result = await db.exec(p_stmt)
        for row in p_result:
            product_counts[row[0]] = row[1]

    items = []
    for s in suppliers:
        s_dict = SupplierResponse.model_validate(s).model_dump()
        s_dict["product_count"] = product_counts.get(s.id, 0)
        items.append(SupplierResponse(**s_dict))

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return SupplierListResponse(
        data=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreateInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Supplier).where(
        Supplier.name == data.name,
        Supplier.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    if result.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Supplier with this name already exists for this tenant",
        )

    supplier = Supplier(
        tenant_id=tenant_id,
        **data.model_dump(),
    )
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    supplier = result.one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    p_stmt = select(func.count(Product.id)).where(
        Product.supplier_id == supplier.id,
        Product.tenant_id == tenant_id,
    )
    p_result = await db.exec(p_stmt)
    product_count = p_result.one()

    sup = SupplierResponse.model_validate(supplier)
    sup_dict = sup.model_dump()
    sup_dict["product_count"] = product_count
    return SupplierResponse(**sup_dict)


@router.patch("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: UUID,
    data: SupplierPatchInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    supplier = result.one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != supplier.name:
        dup_stmt = select(Supplier).where(
            Supplier.name == update_data["name"],
            Supplier.tenant_id == tenant_id,
            Supplier.id != supplier_id,
        )
        dup_result = await db.exec(dup_stmt)
        if dup_result.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Supplier with this name already exists",
            )

    for key, value in update_data.items():
        setattr(supplier, key, value)

    await db.flush()
    await db.refresh(supplier)
    return supplier


@router.delete("/suppliers/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Supplier).where(
        Supplier.id == supplier_id,
        Supplier.tenant_id == tenant_id,
    )
    result = await db.exec(stmt)
    supplier = result.one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    try:
        await db.delete(supplier)
        await db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete supplier: still referenced by one or more products",
        )
