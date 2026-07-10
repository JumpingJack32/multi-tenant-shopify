import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.category import Category
from src.orm.models.product import Inventory, Location, Product, ProductImage, Variant
from src.orm.schemas.inventory import (
    InventoryItemCreateInput,
    InventoryItemPatchInput,
    InventoryItemResponse,
    InventoryListResponse,
    InventoryStatsResponse,
    InventoryVariantResponse,
    PaginationMeta,
)

router = APIRouter(tags=["inventory"])

REORDER_THRESHOLD_DEFAULT = 5


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")
    return s or "untitled"


def _compute_status(total_stock: int, is_active: bool, reorder_level: int = REORDER_THRESHOLD_DEFAULT) -> str:
    if not is_active:
        return "discontinued"
    if total_stock == 0:
        return "out_of_stock"
    if total_stock <= reorder_level:
        return "low_stock"
    return "in_stock"


async def _get_or_create_category(db: AsyncSession, name: str, tenant_id: UUID) -> Category:
    stmt = select(Category).where(Category.name == name, Category.tenant_id == tenant_id)
    result = await db.exec(stmt)
    cat = result.first()
    if not cat:
        cat = Category(
            name=name,
            slug=_slugify(name),
            tenant_id=tenant_id,
            is_active=True,
        )
        db.add(cat)
        await db.flush()
    return cat


async def _build_item_response(db: AsyncSession, product: Product) -> InventoryItemResponse:
    stmt = (
        select(Variant)
        .options(selectinload(Variant.inventory))
        .where(Variant.product_id == product.id, Variant.is_active == True)  # noqa: E712
    )
    result = await db.exec(stmt)
    variants = result.all()

    img_stmt = (
        select(ProductImage)
        .where(ProductImage.product_id == product.id)
        .order_by(ProductImage.sort_order)
        .limit(1)
    )
    img_result = await db.exec(img_stmt)
    first_image = img_result.first()
    image_url = first_image.url if first_image else None

    total_stock = 0
    total_value = 0.0
    variant_responses = []

    for v in variants:
        v_stock = v.inventory_quantity or 0
        total_stock += v_stock
        total_value += (v.price or 0) * v_stock

        reorder_point = REORDER_THRESHOLD_DEFAULT
        warehouse = "Default"
        if v.inventory:
            inv = v.inventory[0]
            reorder_point = inv.reorder_level or REORDER_THRESHOLD_DEFAULT

        variant_responses.append(InventoryVariantResponse(
            id=v.id,
            item_id=product.id,
            name=product.name,
            sku=v.sku,
            barcode=v.barcode,
            price=float(v.price) if v.price is not None else 0.0,
            cost=float(v.price) if v.price is not None else 0.0,
            stock=v_stock,
            reorder_point=reorder_point,
            warehouse=warehouse,
            created_at=v.created_at,
            updated_at=v.updated_at,
        ))

    reorder_level = REORDER_THRESHOLD_DEFAULT
    if variants and variants[0].inventory:
        reorder_level = variants[0].inventory[0].reorder_level or REORDER_THRESHOLD_DEFAULT

    return InventoryItemResponse(
        id=product.id,
        tenant_id=product.tenant_id,
        sku=variants[0].sku if variants else "",
        name=product.name,
        description=product.description,
        category=product.category.name if hasattr(product, "category") and product.category else None,
        image_url=image_url,
        status=_compute_status(total_stock, product.is_active, reorder_level),
        supplier=product.supplier,
        total_stock=total_stock,
        total_value=round(total_value, 2),
        variants=variant_responses,
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("/inventory/stats", response_model=InventoryStatsResponse)
async def get_stats(
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    variant_count_stmt = (
        select(func.count(Variant.id))
        .join(Product)
        .where(Product.tenant_id == tenant_id)
    )
    result = await db.exec(variant_count_stmt)
    total_variants = result.one()

    value_stmt = (
        select(func.coalesce(func.sum(Variant.price * func.coalesce(Variant.inventory_quantity, 0)), 0))
        .join(Product)
        .where(Product.tenant_id == tenant_id)
    )
    result = await db.exec(value_stmt)
    total_value = float(result.one())

    low_stmt = text("""
        SELECT COUNT(*) FROM variants v
        JOIN products p ON p.id = v.product_id AND p.tenant_id = :tid
        WHERE v.inventory_quantity > 0
        AND v.inventory_quantity <= COALESCE(
            (SELECT i.reorder_level FROM inventory i WHERE i.variant_id = v.id LIMIT 1),
            :threshold
        )
    """)
    result = await db.exec(low_stmt, params={"tid": str(tenant_id), "threshold": REORDER_THRESHOLD_DEFAULT})
    low_stock_count = result.scalar()

    oos_stmt = text("""
        SELECT COUNT(*) FROM variants v
        JOIN products p ON p.id = v.product_id AND p.tenant_id = :tid
        WHERE v.inventory_quantity = 0
    """)
    result = await db.exec(oos_stmt, params={"tid": str(tenant_id)})
    out_of_stock_count = result.scalar()

    return InventoryStatsResponse(
        total_skus=total_variants,
        total_value=round(total_value, 2),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        total_variants=total_variants,
    )


@router.get("/inventory", response_model=InventoryListResponse)
async def list_items(
    q: str | None = Query(None),
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    count_stmt = select(func.count(Product.id)).where(Product.tenant_id == tenant_id)
    if q:
        count_stmt = count_stmt.where(Product.name.ilike(f"%{q}%"))
    result = await db.exec(count_stmt)
    total = result.one()

    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.tenant_id == tenant_id)
    )
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.exec(stmt)
    products = result.all()

    items = []
    for product in products:
        item = await _build_item_response(db, product)
        if status and item.status != status:
            continue
        items.append(item)

    total_pages = max(1, (total + page_size - 1) // page_size)

    return InventoryListResponse(
        data=items,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/inventory/{item_id}", response_model=InventoryItemResponse)
async def get_item(
    item_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.id == item_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    return await _build_item_response(db, product)


@router.post("/inventory", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: InventoryItemCreateInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    sku_stmt = select(Variant).where(Variant.sku == data.sku, Variant.tenant_id == tenant_id)
    result = await db.exec(sku_stmt)
    if result.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists for this tenant")

    product = Product(
        name=data.name,
        slug=_slugify(data.name),
        tenant_id=tenant_id,
        is_active=True,
        supplier=data.supplier,
    )
    db.add(product)
    await db.flush()

    if data.category:
        cat = await _get_or_create_category(db, data.category, tenant_id)
        product.category_id = cat.id

    variant = Variant(
        product_id=product.id,
        tenant_id=tenant_id,
        sku=data.sku,
        price=data.price or 0.0,
        inventory_quantity=data.stock or 0,
        is_active=True,
    )
    db.add(variant)
    await db.flush()

    loc_stmt = select(Location).where(Location.tenant_id == tenant_id, Location.is_active == True).limit(1)  # noqa: E712
    result = await db.exec(loc_stmt)
    location = result.first()

    if not location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No warehouse location found for this tenant. Please create a location first.",
        )

    inventory = Inventory(
        variant_id=variant.id,
        location_id=location.id,
        quantity=data.stock or 0,
        reserved_quantity=0,
        reorder_level=REORDER_THRESHOLD_DEFAULT,
        reorder_quantity=50,
    )
    db.add(inventory)
    await db.flush()

    await db.refresh(product)
    return await _build_item_response(db, product)


@router.patch("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_item(
    item_id: UUID,
    data: InventoryItemPatchInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Product)
        .options(selectinload(Product.category))
        .where(Product.id == item_id, Product.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    update_data = data.model_dump(exclude_unset=True)
    product_fields = {"name", "supplier"}

    for key in product_fields & update_data.keys():
        setattr(product, key, update_data[key])

    if "category" in update_data:
        cat_name = update_data["category"]
        if cat_name:
            cat = await _get_or_create_category(db, cat_name, tenant_id)
            product.category_id = cat.id
        else:
            product.category_id = None

    variant_stmt = (
        select(Variant)
        .options(selectinload(Variant.inventory))
        .where(Variant.product_id == product.id, Variant.is_active == True)  # noqa: E712
        .limit(1)
    )
    variant_result = await db.exec(variant_stmt)
    variant = variant_result.first()

    if variant:
        if "sku" in update_data:
            sku_stmt = (
                select(Variant)
                .where(
                    Variant.sku == update_data["sku"],
                    Variant.tenant_id == tenant_id,
                    Variant.id != variant.id,
                )
            )
            result = await db.exec(sku_stmt)
            if result.first():
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU already exists for this tenant")
            variant.sku = update_data["sku"]
        if "price" in update_data:
            variant.price = update_data["price"]
        if "stock" in update_data:
            variant.inventory_quantity = update_data["stock"]
            if variant.inventory:
                variant.inventory[0].quantity = update_data["stock"]

    await db.flush()
    await db.refresh(product)
    return await _build_item_response(db, product)


@router.delete("/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Product).where(Product.id == item_id, Product.tenant_id == tenant_id)
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inventory item not found")

    await db.delete(product)
    await db.flush()
