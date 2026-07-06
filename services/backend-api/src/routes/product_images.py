from uuid import UUID

import asyncio

import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

import src.core.cloudinary  # noqa: F401 — ensures Cloudinary is configured
from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Product, ProductImage
from src.orm.schemas.product import ProductImageCreate, ProductImageResponse, ProductImageUpdate

router = APIRouter()


@router.post("/products/{product_id}/images", response_model=ProductImageResponse, status_code=status.HTTP_201_CREATED)
async def create_product_image(
    product_id: UUID,
    data: ProductImageCreate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    # Verify product exists and belongs to tenant
    stmt = select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    image = ProductImage(
        product_id=product_id,
        tenant_id=tenant_id,
        url=data.url,
        alt_text=data.alt_text,
        sort_order=data.sort_order,
    )
    db.add(image)
    await db.flush()
    await db.refresh(image)
    return image


@router.patch("/product-images/{image_id}", response_model=ProductImageResponse)
async def update_product_image(
    image_id: UUID,
    data: ProductImageUpdate,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductImage).where(ProductImage.id == image_id, ProductImage.tenant_id == tenant_id)
    result = await db.exec(stmt)
    image = result.one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(image, key, value)
    await db.flush()
    await db.refresh(image)
    return image


@router.delete("/product-images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product_image(
    image_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ProductImage).where(ProductImage.id == image_id, ProductImage.tenant_id == tenant_id)
    result = await db.exec(stmt)
    image = result.one_or_none()
    if not image:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Image not found")

    # Destroy the Cloudinary asset (run in thread pool to avoid blocking)
    public_id = image.url
    try:
        await asyncio.to_thread(cloudinary.uploader.destroy, public_id)
    except Exception:
        pass  # Log and continue — DB cleanup is the priority

    await db.delete(image)
    await db.flush()
