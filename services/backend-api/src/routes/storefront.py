"""Storefront-facing endpoints — aggregated read-optimized responses for Next.js."""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.pricing.interceptor import CurrencyAwareRoute
from src.core.tenant_isolation import set_tenant_context
from src.core.throttle import throttle_checkout, throttle_storefront
from src.dependencies import get_db
from src.orm.models.cart import Cart, CartItem, CartStatus
from src.orm.models.collection import Collection, ProductCollection
from src.orm.models.product import Product, Variant
from src.orm.models.tenant import Tenant
from src.orm.schemas.cart import (
    CartAddItemRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateItemRequest,
    CheckoutRequest,
)
from src.orm.schemas.common import PaginatedResponse, PaginationMeta
from src.orm.schemas.order import OrderResponse
from src.orm.schemas.storefront import (
    StorefrontImageResponse,
    StorefrontProductResponse,
    StorefrontVariantResponse,
)
from src.orm.schemas.tenant import TenantSettingsResponse

router = APIRouter(route_class=CurrencyAwareRoute)


async def _resolve_tenant(db: AsyncSession, tenant_slug: str) -> Tenant:
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
    result = await db.exec(stmt)
    tenant = result.one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    set_tenant_context(tenant.tenant_id)
    return tenant


def _build_storefront_product(product: Product) -> StorefrontProductResponse:
    active_variants = [v for v in product.variants if v.is_active]
    prices = [v.price for v in active_variants]

    images = [
        StorefrontImageResponse(
            id=img.id,
            url=img.url,
            alt_text=img.alt_text,
            sort_order=img.sort_order,
        )
        for img in sorted(product.images or [], key=lambda x: x.sort_order)
    ]

    return StorefrontProductResponse(
        id=product.id,
        slug=product.slug,
        name=product.name,
        description=product.description,
        status=product.status.value if hasattr(product.status, "value") else str(product.status),
        min_price=min(prices, default=0),
        max_price=max(prices, default=0),
        images=images,
        variants=[
            StorefrontVariantResponse(
                id=v.id,
                sku=v.sku,
                price=v.price,
                compare_at_price=v.compare_at_price,
                is_active=v.is_active,
                in_stock=v.inventory_quantity > 0,
                options=v.options,
            )
            for v in active_variants
        ],
        category_slug=product.category.slug if product.category else None,
        collection_slugs=[c.slug for c in (product.collections or [])],
        created_at=product.created_at,
        updated_at=product.updated_at,
    )


@router.get("/{tenant_slug}/products", response_model=PaginatedResponse[StorefrontProductResponse])
async def list_storefront_products(
    tenant_slug: str,
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = Query(None),
    collection: str | None = Query(None),
    q: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Paginated list of published products for storefront PLP."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    # Base filters
    base_filters = [
        Product.tenant_id == tenant.tenant_id,
        Product.status == "published",
        Product.is_active,
    ]

    # Count
    count_stmt = select(func.count(Product.id)).where(*base_filters)
    if q:
        count_stmt = count_stmt.where(Product.name.ilike(f"%{q}%"))
    if category:
        from src.orm.models.category import Category
        count_stmt = count_stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category, Category.is_active
        )
    if collection:
        count_stmt = (
            count_stmt.join(ProductCollection, Product.id == ProductCollection.product_id)
            .join(Collection, ProductCollection.collection_id == Collection.id)
            .where(Collection.slug == collection, Collection.is_active)
        )

    result = await db.exec(count_stmt)
    total = result.one()

    # Fetch with eager loading
    stmt = (
        select(Product)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.collections),
        )
        .where(*base_filters)
    )

    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q}%"))

    if category:
        from src.orm.models.category import Category
        stmt = stmt.join(Category, Product.category_id == Category.id).where(
            Category.slug == category, Category.is_active
        )

    if collection:
        stmt = (
            stmt.join(ProductCollection, Product.id == ProductCollection.product_id)
            .join(Collection, ProductCollection.collection_id == Collection.id)
            .where(Collection.slug == collection, Collection.is_active)
        )

    stmt = stmt.order_by(Product.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.exec(stmt)
    products = result.all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0

    return PaginatedResponse(
        data=[_build_storefront_product(p) for p in products],
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{tenant_slug}/products/{product_slug}", response_model=StorefrontProductResponse)
async def get_storefront_product(
    tenant_slug: str,
    request: Request,
    product_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Single product detail for storefront PDP."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    stmt = (
        select(Product)
        .options(
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
            selectinload(Product.collections),
        )
        .where(
            Product.tenant_id == tenant.tenant_id,
            Product.slug == product_slug,
            Product.status == "published",
            Product.is_active,
        )
    )
    result = await db.exec(stmt)
    product = result.one_or_none()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    return _build_storefront_product(product)


# ─── Tenant Settings ──────────────────────────────────────────────────


@router.get("/{tenant_slug}/settings", response_model=TenantSettingsResponse)
async def get_tenant_settings(
    tenant_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Public tenant settings — store name, currency, theme preferences."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    return TenantSettingsResponse(
        name=tenant.name,
        slug=tenant.slug,
        currency=tenant.settings.get("currency", "USD"),
        theme=tenant.settings.get("theme", {}),
    )


# ─── Cart CRUD ────────────────────────────────────────────────────────


async def _get_cart(cart_id: UUID, tenant_id: UUID, db: AsyncSession) -> Cart:
    stmt = (
        select(Cart)
        .options(
            selectinload(Cart.items).selectinload(CartItem.variant).selectinload(Variant.product),
        )
        .where(Cart.id == cart_id, Cart.tenant_id == tenant_id)
    )
    result = await db.exec(stmt)
    cart = result.one_or_none()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")
    return cart


async def _build_cart_response(cart: Cart, db=None, tenant_id=None) -> CartResponse:
    from src.orm.models.tenant import TenantTaxConfig
    from src.services.tax_service import calculate_tax

    tax_config = None
    if db and tenant_id:
        tax_stmt = select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant_id)
        tax_config = (await db.exec(tax_stmt)).one_or_none()

    items = []
    subtotal = 0
    tax_total = 0

    for ci in cart.items:
        v = ci.variant
        price = v.price if v else 0
        item_subtotal = price * ci.quantity
        subtotal += item_subtotal

        if tax_config and tax_config.enabled:
            item_tax, _ = calculate_tax(item_subtotal, tax_config.default_rate, tax_config.tax_inclusive)
        else:
            item_tax = 0
        tax_total += item_tax

        items.append(CartItemResponse(
            id=ci.id,
            variant_id=ci.variant_id,
            sku=v.sku if v else "",
            product_name=v.product.name if v and v.product else "",
            variant_name=ci.variant.options.get("Name") if v else None,
            price=price,
            quantity=ci.quantity,
            image_url=None,
        ))

    grand_total = subtotal if (tax_config and tax_config.tax_inclusive) else subtotal + tax_total

    return CartResponse(
        id=cart.id,
        items=items,
        item_count=sum(i.quantity for i in cart.items),
        subtotal=subtotal,
        tax_total=tax_total,
        total=grand_total,
        status=cart.status.value if hasattr(cart.status, "value") else cart.status,
        created_at=cart.created_at,
        updated_at=cart.updated_at,
    )


@router.post("/{tenant_slug}/carts", response_model=CartResponse, status_code=status.HTTP_201_CREATED)
async def create_cart(
    tenant_slug: str,
    request: Request,
    body: CartAddItemRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_storefront),
):
    """Create a new cart with the first item."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    # Validate variant exists and belongs to tenant
    stmt = select(Variant).where(Variant.id == body.variant_id, Variant.tenant_id == tenant.tenant_id)
    variant = (await db.exec(stmt)).one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    cart = Cart(tenant_id=tenant.tenant_id)
    db.add(cart)
    await db.flush()

    item = CartItem(cart_id=cart.id, tenant_id=tenant.tenant_id, variant_id=body.variant_id, quantity=body.quantity)
    db.add(item)
    await db.flush()

    cart = await _get_cart(cart.id, tenant.tenant_id, db)
    return await _build_cart_response(cart, db, tenant.tenant_id)


@router.get("/{tenant_slug}/carts/{cart_id}", response_model=CartResponse)
async def get_cart(
    tenant_slug: str,
    request: Request,
    cart_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get cart contents with tax breakdown."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    cart = await _get_cart(cart_id, tenant.tenant_id, db)

    return await _build_cart_response(cart, db, tenant.tenant_id)


@router.post("/{tenant_slug}/carts/{cart_id}/items", response_model=CartResponse)
async def add_cart_item(
    tenant_slug: str,
    request: Request,
    cart_id: UUID,
    body: CartAddItemRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_storefront),
):
    """Add an item to an existing cart."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    cart = await _get_cart(cart_id, tenant.tenant_id, db)

    # Validate variant
    stmt = select(Variant).where(Variant.id == body.variant_id, Variant.tenant_id == tenant.tenant_id)
    variant = (await db.exec(stmt)).one_or_none()
    if not variant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

    # Check if variant already in cart — increment quantity
    existing = [ci for ci in cart.items if ci.variant_id == body.variant_id]
    if existing:
        existing[0].quantity += body.quantity
    else:
        item = CartItem(cart_id=cart.id, tenant_id=tenant.tenant_id, variant_id=body.variant_id, quantity=body.quantity)
        db.add(item)

    await db.flush()
    cart = await _get_cart(cart.id, tenant.tenant_id, db)
    return await _build_cart_response(cart, db, tenant.tenant_id)


@router.patch("/{tenant_slug}/carts/{cart_id}/items/{item_id}", response_model=CartResponse)
async def update_cart_item(
    tenant_slug: str,
    request: Request,
    cart_id: UUID,
    item_id: UUID,
    body: CartUpdateItemRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update item quantity. If quantity is 0, removes the item."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    cart = await _get_cart(cart_id, tenant.tenant_id, db)

    item = next((ci for ci in cart.items if ci.id == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    if body.quantity == 0:
        await db.delete(item)
    else:
        item.quantity = body.quantity

    await db.flush()
    cart = await _get_cart(cart.id, tenant.tenant_id, db)
    return await _build_cart_response(cart, db, tenant.tenant_id)


@router.delete("/{tenant_slug}/carts/{cart_id}/items/{item_id}", response_model=CartResponse)
async def remove_cart_item(
    tenant_slug: str,
    request: Request,
    cart_id: UUID,
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from the cart."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    cart = await _get_cart(cart_id, tenant.tenant_id, db)

    item = next((ci for ci in cart.items if ci.id == item_id), None)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    await db.delete(item)
    await db.flush()
    cart = await _get_cart(cart.id, tenant.tenant_id, db)
    return await _build_cart_response(cart, db, tenant.tenant_id)


@router.delete("/{tenant_slug}/carts/{cart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_cart(
    tenant_slug: str,
    request: Request,
    cart_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Clear all items from the cart."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    stmt = select(Cart).where(Cart.id == cart_id, Cart.tenant_id == tenant.tenant_id)
    cart = (await db.exec(stmt)).one_or_none()
    if not cart:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found")

    await db.delete(cart)
    await db.flush()


# ─── Checkout ──────────────────────────────────────────────────────────


@router.post("/{tenant_slug}/carts/{cart_id}/checkout", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    tenant_slug: str,
    cart_id: UUID,
    request: Request,
    body: CheckoutRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    """Convert cart to order. Validates stock, creates order, decrements inventory."""
    from src.orm.models.order import Order, OrderItem as OrderItemModel

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    cart = await _get_cart(cart_id, tenant.tenant_id, db)

    if not cart.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    # Validate stock for all items
    for ci in cart.items:
        v = ci.variant
        if not v:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Variant {ci.variant_id} not found")
        if v.inventory_quantity < ci.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for variant {v.sku}: requested {ci.quantity}, available {v.inventory_quantity}",
            )

    # Use consumer's preferred currency if available
    preferred = getattr(request.state, "target_currency", None)
    if preferred:
        body.currency = preferred

    # Calculate totals with per-item tax
    from src.orm.models.tenant import TenantTaxConfig
    from src.services.tax_service import calculate_tax

    tax_stmt = select(TenantTaxConfig).where(TenantTaxConfig.tenant_id == tenant.tenant_id)
    tax_config = (await db.exec(tax_stmt)).one_or_none()

    subtotal = 0
    tax_total = 0
    item_tax_data: list[dict] = []
    for ci in cart.items:
        item_subtotal = ci.variant.price * ci.quantity
        subtotal += item_subtotal
        if tax_config and tax_config.enabled:
            item_tax, _ = calculate_tax(item_subtotal, tax_config.default_rate, tax_config.tax_inclusive)
        else:
            item_tax = 0
        tax_total += item_tax
        item_tax_data.append({
            "variant_id": ci.variant_id,
            "tax_rate": tax_config.default_rate if tax_config else 0,
            "tax_amount": item_tax,
        })

    order_number = f"SF-{uuid4().hex[:12].upper()}"

    grand_total = subtotal if (tax_config and tax_config.tax_inclusive) else subtotal + tax_total

    order = Order(
        tenant_id=tenant.tenant_id,
        order_number=order_number,
        status="pending",
        payment_status="pending",
        subtotal=subtotal,
        tax=tax_total,
        total=grand_total,
        currency=body.currency or "USD",
        shipping_address=body.shipping_address or {},
        billing_address=body.billing_address or {},
        notes=body.notes,
    )
    db.add(order)
    await db.flush()

    # Create order items + decrement inventory
    tax_lookup = {d["variant_id"]: d for d in item_tax_data}
    for ci in cart.items:
        v = ci.variant
        tx = tax_lookup.get(ci.variant_id, {})
        oi = OrderItemModel(
            order_id=order.id,
            tenant_id=tenant.tenant_id,
            variant_id=v.id,
            product_id=v.product_id,
            product_name=v.product.name if v.product else "",
            sku=v.sku,
            quantity=ci.quantity,
            unit_price=v.price,
            total_price=v.price * ci.quantity,
            tax_rate=tx.get("tax_rate", 0),
            tax_amount=tx.get("tax_amount", 0),
        )
        db.add(oi)
        v.inventory_quantity -= ci.quantity

    # Mark cart as completed instead of deleting
    cart.email = body.customer_email
    cart.status = CartStatus.COMPLETED
    cart.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(order, ["items"])

    return order


@router.get("/{tenant_slug}/orders/{order_id}", response_model=OrderResponse)
async def get_storefront_order(
    tenant_slug: str,
    request: Request,
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Tenant-scoped order lookup for order confirmation page."""
    from src.orm.models.order import Order

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.tenant_id == tenant.tenant_id)
    )
    result = await db.exec(stmt)
    order = result.one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return order
