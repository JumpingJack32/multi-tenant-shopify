from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Product, Variant
from src.orm.schemas.product import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    VariantCreate,
    VariantResponse,
    VariantUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[ProductResponse])
async def list_products(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.tenant_id == tenant_id, Product.is_active == True)  # noqa: E712
    )
    result = await db.exec(stmt)
    products = result.all()
    return products


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = Product(**data.model_dump(), tenant_id=tenant_id)
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: UUID,
    data: ProductUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.images))
        .where(Product.id == product_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(product, key, value)

    await db.flush()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await db.delete(product)
    await db.flush()


# ─── Variant CRUD ──────────────────────────────────────────────────────


async def _get_product_for_variant(product_id: UUID, tenant_id: UUID, db: AsyncSession) -> Product:
    stmt = select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.get("/{product_id}/variants", response_model=list[VariantResponse])
async def list_variants(
    product_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_product_for_variant(product_id, tenant_id, db)
    stmt = (
        select(Variant)
        .where(Variant.product_id == product.id, Variant.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    return result.all()


@router.post("/{product_id}/variants", response_model=VariantResponse, status_code=status.HTTP_201_CREATED)
async def create_variant(
    product_id: UUID,
    data: VariantCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_product_for_variant(product_id, tenant_id, db)
    variant = Variant(**data.model_dump(), product_id=product.id, tenant_id=tenant_id)
    db.add(variant)
    await db.flush()
    await db.refresh(variant)
    return variant


@router.get("/{product_id}/variants/{variant_id}", response_model=VariantResponse)
async def get_variant(
    product_id: UUID,
    variant_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_product_for_variant(product_id, tenant_id, db)
    stmt = (
        select(Variant)
        .where(Variant.id == variant_id, Variant.product_id == product.id, Variant.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    variant = result.one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")
    return variant


@router.put("/{product_id}/variants/{variant_id}", response_model=VariantResponse)
async def update_variant(
    product_id: UUID,
    variant_id: UUID,
    data: VariantUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_product_for_variant(product_id, tenant_id, db)
    stmt = (
        select(Variant)
        .where(Variant.id == variant_id, Variant.product_id == product.id, Variant.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    variant = result.one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(variant, key, value)

    await db.flush()
    await db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_variant(
    product_id: UUID,
    variant_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    product = await _get_product_for_variant(product_id, tenant_id, db)
    stmt = (
        select(Variant)
        .where(Variant.id == variant_id, Variant.product_id == product.id, Variant.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    variant = result.one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    await db.delete(variant)
    await db.flush()
