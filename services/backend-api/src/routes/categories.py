from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, func
from src.orm.models.category import Category
from src.orm.models.product import Product
from src.orm.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from src.dependencies import get_db, get_current_tenant_id

router = APIRouter(tags=["categories"])


@router.get("/categories/", response_model=list[CategoryResponse])
async def list_categories(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    include_inactive: bool = False,
):
    stmt = select(Category).where(Category.tenant_id == tenant_id)
    if not include_inactive:
        stmt = stmt.where(Category.is_active == True)
    stmt = stmt.order_by(Category.sort_order, Category.name)
    categories = (await db.exec(stmt)).all()
    result = []
    for cat in categories:
        count_stmt = select(func.count()).select_from(Product).where(
            Product.category_id == cat.id,
            Product.tenant_id == tenant_id,
        )
        count = (await db.exec(count_stmt)).one()
        result.append(CategoryResponse(
            **cat.model_dump(),
            product_count=count,
        ))
    return result


@router.post("/categories/", response_model=CategoryResponse)
async def create_category(
    data: CategoryCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    cat = Category(**data.model_dump(), tenant_id=tenant_id)
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return CategoryResponse(**cat.model_dump(), product_count=0)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Category).where(
        Category.id == category_id,
        Category.tenant_id == tenant_id,
    )
    cat = (await db.exec(stmt)).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(cat, key, value)
    await db.commit()
    await db.refresh(cat)
    count_stmt = select(func.count()).select_from(Product).where(
        Product.category_id == cat.id,
        Product.tenant_id == tenant_id,
    )
    count = (await db.exec(count_stmt)).one()
    return CategoryResponse(**cat.model_dump(), product_count=count)


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(Category).where(
        Category.id == category_id,
        Category.tenant_id == tenant_id,
    )
    cat = (await db.exec(stmt)).one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return {"ok": True}
