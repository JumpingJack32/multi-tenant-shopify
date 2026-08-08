"""Storefront-facing endpoints — aggregated read-optimized responses for Next.js."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import selectinload
from sqlmodel import func, select, text as sql_text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.pricing.interceptor import CurrencyAwareRoute
from src.core.tenant_isolation import set_tenant_context
from src.core.throttle import throttle_checkout, throttle_storefront
from src.dependencies import get_db
from src.orm.models.cart import Cart, CartItem, CartStatus
from src.orm.models.collection import Collection, ProductCollection
from src.orm.models.order import OrderStatus, PaymentStatus
from src.orm.models.product import Product, Variant
from src.orm.models.tenant import Tenant
from src.orm.schemas.cart import (
    CartAddItemRequest,
    CartItemResponse,
    CartResponse,
    CartUpdateItemRequest,
    CheckoutIntentRequest,
    CheckoutIntentResponse,
    CheckoutRequest,
    CreateOrderRequest,
    PortalRequest,
)
from src.orm.schemas.common import PaginatedResponse, PaginationMeta
from src.orm.schemas.order import OrderDetailResponse, OrderResponse
from src.orm.schemas.shipping import ShippingRateResult
from src.orm.schemas.storefront import (
    StorefrontImageResponse,
    StorefrontProductResponse,
    StorefrontVariantResponse,
)
from src.orm.schemas.tenant import TenantSettingsResponse
from src.services.stripe_adapter import CheckoutItem, get_stripe_adapter

router = APIRouter(route_class=CurrencyAwareRoute)


async def _resolve_tenant(db: AsyncSession, tenant_slug: str) -> Tenant:
    stmt = select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "ACTIVE")
    result = await db.exec(stmt)
    tenant = result.one_or_none()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    set_tenant_context(tenant.tenant_id)
    return tenant


def _build_storefront_product(
    product: Product,
    display_currency: str | None = None,
    display_prices: dict[UUID, int] | None = None,
) -> StorefrontProductResponse:
    active_variants = [v for v in product.variants if v.is_active]
    prices = [v.price for v in active_variants]

    # Compute display prices if conversion data is provided
    if display_prices:
        disp_prices_list = [display_prices.get(v.id, v.price) for v in active_variants]
        display_min = min(disp_prices_list, default=0)
        display_max = max(disp_prices_list, default=0)
    else:
        disp_prices_list = None
        display_min = None
        display_max = None

    images = [
        StorefrontImageResponse(
            id=img.id,
            url=img.url,
            alt_text=img.alt_text,
            sort_order=img.sort_order,
        )
        for img in sorted(product.images or [], key=lambda x: x.sort_order)
    ]

    variants_response = []
    for v in active_variants:
        v_display_price = display_prices.get(v.id) if display_prices else None
        variants_response.append(StorefrontVariantResponse(
            id=v.id,
            sku=v.sku,
            price=v.price,
            compare_at_price=v.compare_at_price,
            is_active=v.is_active,
            in_stock=v.inventory_quantity > 0,
            options=v.options,
            display_price=v_display_price,
            display_currency=display_currency,
        ))

    return StorefrontProductResponse(
        id=product.id,
        slug=product.slug,
        name=product.name,
        description=product.description,
        specs=product.specs,
        status=product.status.value if hasattr(product.status, "value") else str(product.status),
        min_price=min(prices, default=0),
        max_price=max(prices, default=0),
        display_min_price=display_min,
        display_max_price=display_max,
        display_currency=display_currency,
        images=images,
        variants=variants_response,
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

    # Apply currency conversion if shopper prefers a different currency
    preferred = getattr(request.state, "target_currency", None)
    base_currency = getattr(request.state, "base_currency", None)
    if preferred and base_currency and preferred != base_currency:
        from src.services.conversion_service import convert_price

        product_responses = []
        for p in products:
            display_prices = {}
            for v in (pv for pv in p.variants if pv.is_active):
                display_prices[v.id] = await convert_price(v.price, base_currency, preferred, db)
            product_responses.append(_build_storefront_product(p, preferred, display_prices))
    else:
        product_responses = [_build_storefront_product(p) for p in products]

    return PaginatedResponse(
        data=product_responses,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.get("/{tenant_slug}/products/search", response_model=list[StorefrontProductResponse])
async def search_products(
    tenant_slug: str,
    request: Request,
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=10, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across product names and descriptions."""
    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")
    preferred = getattr(request.state, "target_currency", None)

    result = await db.execute(
        sql_text("""
            SELECT p.id, p.name, p.slug, p.description, p.is_active
            FROM products p, websearch_to_tsquery('english', :q) AS query
            WHERE p.tenant_id = :tid
              AND p.search_vector @@ query
              AND LOWER(p.status::text) = 'published'
            ORDER BY ts_rank(p.search_vector, query) DESC
            LIMIT :lim
        """),
        {"q": q, "tid": tenant.tenant_id, "lim": limit},
    )
    rows = result.all()

    products_list: list[StorefrontProductResponse] = []
    for row in rows:
        p = (await db.exec(
            select(Product)
            .options(
                selectinload(Product.variants),
                selectinload(Product.images),
                selectinload(Product.category),
                selectinload(Product.collections),
            )
            .where(Product.id == row[0])
        )).first()
        if p:
            products_list.append(_build_storefront_product(p, preferred))

    return products_list


@router.get("/{tenant_slug}/products/suggest")
async def suggest_products(
    tenant_slug: str,
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=5, le=20),
    db: AsyncSession = Depends(get_db),
):
    """Autocomplete suggestions matching prefix query."""
    tenant = await _resolve_tenant(db, tenant_slug)
    result = await db.execute(
        sql_text("""
            SELECT DISTINCT name
            FROM products
            WHERE tenant_id = :tid
              AND search_vector @@ to_tsquery('english', :q || ':*')
              AND LOWER(status::text) = 'published'
            LIMIT :lim
        """),
        {"q": q, "tid": tenant.tenant_id, "lim": limit},
    )
    suggestions = [r[0] for r in result.all()]
    return {"suggestions": suggestions}


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

    preferred = getattr(request.state, "target_currency", None)
    base_currency = getattr(request.state, "base_currency", None)
    if preferred and base_currency and preferred != base_currency:
        from src.services.conversion_service import convert_price

        display_prices = {}
        for v in (pv for pv in product.variants if pv.is_active):
            display_prices[v.id] = await convert_price(v.price, base_currency, preferred, db)
        return _build_storefront_product(product, preferred, display_prices)

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


@router.get("/{tenant_slug}/shipping-info")
async def get_shipping_info(
    tenant_slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Public shipping info — free shipping threshold and active methods."""
    from src.orm.models.shipping import ShippingMethod

    tenant = await _resolve_tenant(db, tenant_slug)
    result = await db.exec(
        select(ShippingMethod).where(
            ShippingMethod.tenant_id == tenant.tenant_id,
            ShippingMethod.is_active == True,
        )
    )
    methods = result.all()
    min_threshold = None
    for m in methods:
        if m.free_shipping_threshold is not None:
            if min_threshold is None or m.free_shipping_threshold < min_threshold:
                min_threshold = m.free_shipping_threshold
    return {
        "free_shipping_threshold": float(min_threshold) if min_threshold else None,
        "methods": [{"name": m.name, "rate_type": m.rate_type, "base_price": float(m.base_price)} for m in methods],
    }


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


async def _build_cart_response(
    cart: Cart, db=None, tenant_id=None,
    target_currency: str | None = None,
    base_currency: str | None = None,
) -> CartResponse:
    from src.orm.models.tenant import TenantTaxConfig
    from src.services.conversion_service import convert_price
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

    # Convert to shopper's preferred currency if different from base
    if target_currency and base_currency and target_currency != base_currency:
        subtotal = await convert_price(subtotal, base_currency, target_currency, db)
        tax_total = await convert_price(tax_total, base_currency, target_currency, db)
        grand_total = await convert_price(grand_total, base_currency, target_currency, db)

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
    return await _build_cart_response(cart, db, tenant.tenant_id,
        target_currency=getattr(request.state, "target_currency", None),
        base_currency=getattr(request.state, "base_currency", None))


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

    return await _build_cart_response(cart, db, tenant.tenant_id,
        target_currency=getattr(request.state, "target_currency", None),
        base_currency=getattr(request.state, "base_currency", None))


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
    return await _build_cart_response(cart, db, tenant.tenant_id,
        target_currency=getattr(request.state, "target_currency", None),
        base_currency=getattr(request.state, "base_currency", None))


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
    return await _build_cart_response(cart, db, tenant.tenant_id,
        target_currency=getattr(request.state, "target_currency", None),
        base_currency=getattr(request.state, "base_currency", None))


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
    return await _build_cart_response(cart, db, tenant.tenant_id,
        target_currency=getattr(request.state, "target_currency", None),
        base_currency=getattr(request.state, "base_currency", None))


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

    # Reserve inventory at best available node
    from src.services.inventory_service import auto_allocate, reserve as reserve_stock

    allocation: dict[UUID, UUID] = {}
    for ci in cart.items:
        node_id = await auto_allocate(db, tenant.tenant_id, ci.variant_id, ci.quantity)
        if not node_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No warehouse with sufficient stock for variant {ci.variant.sku}",
            )
        await reserve_stock(db, ci.variant_id, node_id, ci.quantity)
        allocation[ci.variant_id] = node_id

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

    # Calculate shipping
    shipping_total = 0
    from src.services.shipping_service import calculate_shipping_rates
    cart_item_list = [{"variant_id": ci.variant_id, "quantity": ci.quantity} for ci in cart.items]
    shipping_rates = await calculate_shipping_rates(db, tenant.tenant_id, subtotal, items=cart_item_list)
    if shipping_rates:
        cheapest = min(shipping_rates, key=lambda r: r.cost)
        shipping_total = int(cheapest.cost * Decimal("100"))

    base_total = subtotal if (tax_config and tax_config.tax_inclusive) else subtotal + tax_total
    grand_total = base_total + shipping_total

    # Capture exchange rate for ledger integrity
    base_currency = getattr(request.state, "base_currency", "GBP")
    exchange_rate = Decimal("1.0")
    total_base = grand_total
    if preferred and base_currency and preferred != base_currency:
        from src.core.exchange_rates.service import RateService

        rate_svc = RateService()
        exchange_rate = await rate_svc.get_rate(base_currency, preferred)
        total_base = round(Decimal(grand_total) / exchange_rate)

    order = Order(
        base_currency=base_currency,
        exchange_rate=exchange_rate,
        total_base=total_base,
        tenant_id=tenant.tenant_id,
        order_number=order_number,
        status="pending",
        payment_status="pending",
        subtotal=subtotal,
        tax=tax_total,
        shipping=shipping_total,
        total=grand_total,
        currency=body.currency or "USD",
        shipping_address=body.shipping_address or {},
        billing_address=body.billing_address or {},
        notes=body.notes,
        options={"node_allocations": {str(k): str(v) for k, v in allocation.items()}},
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
    order.customer_email = (body.customer_email or "").lower().strip() or None
    await db.flush()
    await db.refresh(order, ["items"])

    # Send order confirmation email in background
    if order.customer_email:
        import asyncio

        from src.services.email_service import create_email_service

        email_svc = create_email_service()
        asyncio.create_task(
            email_svc.send_order_confirmation(
                to_email=order.customer_email,
                order={
                    "order_number": order.order_number,
                    "total": order.total,
                    "items": [
                        {
                            "product_name": oi.product_name,
                            "variant_name": oi.variant_name or "",
                            "quantity": oi.quantity,
                            "total_price": oi.total_price,
                        }
                        for oi in (order.items or [])
                    ],
                    "shipping_address": order.shipping_address,
                },
                tenant_name=tenant.name or tenant.slug,
                currency=order.currency,
                account_url=f"https://{tenant.domain if tenant.domain else tenant.slug + '.example.com'}/account/orders/{order.id}",
            )
        )

    return order


# ─── Stripe Checkout ──────────────────────────────────────────────────


@router.post("/{tenant_slug}/checkout/intent", response_model=CheckoutIntentResponse)
async def create_checkout_intent(
    tenant_slug: str,
    request: Request,
    body: CheckoutIntentRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    """Create Stripe PaymentIntent with server-side price verification."""
    import stripe

    from src.config import settings
    from src.orm.models.order import Order, OrderItem as OrderItemModel

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Checkout unavailable")

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    # Verify prices server-side
    variant_ids = [UUID(item.variant_id) for item in body.items]
    stmt = select(Variant).where(Variant.id.in_(variant_ids), Variant.tenant_id == tenant.tenant_id)  # type: ignore[arg-type]
    variants = {v.id: v for v in (await db.exec(stmt)).all()}

    total = 0
    order_items_data = []
    for item in body.items:
        vid = UUID(item.variant_id)
        v = variants.get(vid)
        if not v:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Variant {vid} not found")
        if v.inventory_quantity < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for variant {v.sku}",
            )
        item_total = v.price * item.quantity
        total += item_total
        order_items_data.append({"variant": v, "quantity": item.quantity})

    stripe.api_key = settings.stripe_secret_key
    intent = stripe.PaymentIntent.create(
        amount=total,
        currency=tenant.settings.get("currency", "gbp").lower(),
        metadata={"tenant": tenant_slug},
    )

    order = Order(
        tenant_id=tenant.tenant_id,
        customer_email=body.customer_email,
        order_number=f"SF-{uuid4().hex[:12].upper()}",
        status=OrderStatus.PENDING_PAYMENT,
        payment_status=PaymentStatus.PENDING,
        payment_intent_id=intent.id,
        stripe_client_secret=intent.client_secret,
        total=total,
        currency=tenant.settings.get("currency", "GBP"),
        base_currency=getattr(request.state, "base_currency", "GBP"),
        inventory_deducted=False,
    )
    db.add(order)
    await db.flush()

    for od in order_items_data:
        v = od["variant"]
        qty = od["quantity"]
        oi = OrderItemModel(
            order_id=order.id,
            tenant_id=tenant.tenant_id,
            variant_id=v.id,
            product_id=v.product_id,
            product_name=v.product.name if v.product else "",
            sku=v.sku,
            quantity=qty,
            unit_price=v.price,
            total_price=v.price * qty,
        )
        db.add(oi)

    await db.commit()
    await db.refresh(order)

    return CheckoutIntentResponse(
        clientSecret=intent.client_secret,
        amount=total,
        currency=order.currency,
    )


@router.post("/{tenant_slug}/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
async def create_storefront_order(
    tenant_slug: str,
    request: Request,
    body: CreateOrderRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    """Finalize order after successful Stripe payment."""
    import stripe

    from src.config import settings
    from src.services.order_lifecycle import OrderLifecycleService

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Checkout unavailable")

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    # Verify payment with Stripe
    stripe.api_key = settings.stripe_secret_key
    try:
        pi = stripe.PaymentIntent.retrieve(body.payment_intent_id)
    except stripe.error.StripeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment intent")

    if pi.status != "succeeded":
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Payment not completed")

    # Finalize order idempotently
    svc = OrderLifecycleService(db)
    order = await svc.finalize_successful_order(body.payment_intent_id)

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Update shipping info
    order.shipping_address = body.shipping_address
    order.customer_email = body.customer_email
    db.add(order)
    await db.commit()
    await db.refresh(order, ["items"])

    return order


@router.post("/{tenant_slug}/checkout/session", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_storefront_checkout_session(
    tenant_slug: str,
    request: Request,
    payload: CheckoutIntentRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    """Create a Stripe Checkout Session — hosted payment page."""
    from src.config import settings

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Checkout unavailable")

    adapter = get_stripe_adapter()
    has_subscription = any(i.subscription_plan_id for i in payload.items)
    items = [
        CheckoutItem(
            variant_id=UUID(i.variant_id),
            quantity=i.quantity,
            subscription_plan_id=UUID(i.subscription_plan_id) if i.subscription_plan_id else None,
        )
        for i in payload.items
    ]

    base_url = str(request.base_url).rstrip("/")
    success_url = f"{base_url}/{tenant_slug}/checkout/success?session_id=" + "{CHECKOUT_SESSION_ID}"
    cancel_url = f"{base_url}/{tenant_slug}/checkout"

    if has_subscription:
        result = await adapter.create_subscription_checkout(
            tenant_id=tenant.tenant_id,
            tenant_slug=tenant_slug,
            customer_email=payload.customer_email,
            items=items,
            success_url=success_url,
            cancel_url=cancel_url,
            db=db,
        )
    else:
        result = await adapter.create_checkout(
            tenant_id=tenant.tenant_id,
            tenant_slug=tenant_slug,
            customer_email=payload.customer_email,
            items=items,
            success_url=success_url,
            cancel_url=cancel_url,
            db=db,
        )

    return {"session_id": result.session_id, "session_url": result.session_url}


@router.post("/{tenant_slug}/customer-portal")
async def create_customer_portal(
    tenant_slug: str,
    request: Request,
    body: PortalRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_checkout),
):
    """Create a Stripe Customer Portal session for managing saved cards/billing.

    Verification is tiered:
      - Registered user (Clerk Bearer token) → verified via identity
      - Guest → email + (order_number OR shipping zip) must match a PAID order
    """
    from src.config import settings
    from src.services.portal_service import (
        build_guest_cookie,
        create_guest_portal_token,
        normalize_email,
        verify_guest,
    )

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Checkout unavailable")

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    # Attempt Clerk identity first (registered user)
    email = ""
    clerk_verified = False
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from src.dependencies import get_current_user
            claims = await get_current_user(request)
            email = normalize_email(claims.get("email") or "")
            if email:
                clerk_verified = True
        except Exception:
            pass

    # Guest path
    if not clerk_verified:
        email = normalize_email(body.customer_email)
        if not email:
            raise HTTPException(status_code=400, detail="customer_email required")
        verified = await verify_guest(
            db,
            tenant_id=tenant.tenant_id,
            email=email,
            order_number=body.order_number,
            shipping_zip=body.shipping_zip,
        )
        if not verified:
            raise HTTPException(status_code=403, detail="Verification failed — email must match a paid order")

    adapter = get_stripe_adapter()
    base_url = str(request.base_url).rstrip("/")
    return_url = f"{base_url}/{tenant_slug}/account?billing=1"

    if not clerk_verified:
        # Issue a short-lived guest identity cookie
        token = create_guest_portal_token(email, tenant.tenant_id)
        response.set_cookie(**build_guest_cookie(token))

    url = await adapter.create_customer_portal_session(
        customer_email=email,
        tenant_id=tenant.tenant_id,
        return_url=return_url,
    )

    return {"url": url, "verified": True}


@router.get("/{tenant_slug}/payment-methods")
async def list_payment_methods(
    tenant_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(throttle_storefront),
):
    """List saved payment methods (sanitized preview) for the verified customer."""
    from src.config import settings
    from src.services.portal_service import (
        normalize_email,
        parse_guest_portal_token,
        verify_guest,
    )

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Checkout unavailable")

    tenant = await _resolve_tenant(db, tenant_slug)

    email = ""
    clerk_verified = False
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            from src.dependencies import get_current_user
            claims = await get_current_user(request)
            email = normalize_email(claims.get("email") or "")
            clerk_verified = bool(email)
        except Exception:
            pass

    if not clerk_verified:
        # Guest: use the signed cookie token, or fall back to email-only with
        # a PAID order check (no order-number required for read-only preview).
        guest_token = request.cookies.get("guest_customer")
        if guest_token:
            payload = parse_guest_portal_token(guest_token)
            if payload and payload.get("tenant_id") == str(tenant.tenant_id):
                email = payload.get("guest_customer") or ""
        if not email:
            email = normalize_email(request.query_params.get("email") or "")
        if not email:
            raise HTTPException(status_code=401, detail="Not authenticated")
        verified = await verify_guest(db, tenant_id=tenant.tenant_id, email=email)
        if not verified:
            raise HTTPException(status_code=403, detail="No paid orders found for this email")

    adapter = get_stripe_adapter()
    return await adapter.list_payment_methods(
        customer_email=email,
        tenant_id=tenant.tenant_id,
    )


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events via the active adapter."""
    from src.config import settings

    if not settings.stripe_enabled:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing stripe-signature header")

    adapter = get_stripe_adapter()
    order_id = await adapter.handle_event(payload, sig_header, db)

    return {"ok": True, "order_id": order_id}


@router.get("/{tenant_slug}/orders/{order_id}", response_model=OrderDetailResponse)
async def get_storefront_order(
    tenant_slug: str,
    request: Request,
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Tenant-scoped order lookup for order confirmation page."""
    from src.orm.models.fulfillment import Fulfillment
    from src.orm.models.order import Order

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    stmt = (
        select(Order)
        .options(
            selectinload(Order.items),
            selectinload(Order.fulfillments).selectinload(Fulfillment.items),
        )
        .where(Order.id == order_id, Order.tenant_id == tenant.tenant_id)
    )
    result = await db.exec(stmt)
    order = result.one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return OrderDetailResponse.model_validate(order, from_attributes=True)


@router.get("/{tenant_slug}/orders/by-session/{session_id}", response_model=OrderResponse)
async def get_storefront_order_by_session(
    tenant_slug: str,
    request: Request,
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Look up an order by Stripe Checkout Session ID."""
    from sqlalchemy.orm import selectinload

    from src.orm.models.order import Order

    tenant = await _resolve_tenant(db, tenant_slug)
    request.state.base_currency = (tenant.settings or {}).get("currency", "GBP")

    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.payment_intent_id == session_id,
            Order.tenant_id == tenant.tenant_id,
        )
    )
    result = await db.exec(stmt)
    order = result.one_or_none()

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found or processing payment")

    return order


@router.get("/{tenant_slug}/customers/orders", response_model=list[OrderResponse])
async def get_customer_orders(
    tenant_slug: str,
    customer_email: str = Query(..., description="Customer email to filter orders"),
    db: AsyncSession = Depends(get_db),
):
    """List orders for a customer by email. Used by the account orders page."""
    from src.orm.models.order import Order

    tenant = await _resolve_tenant(db, tenant_slug)

    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(
            Order.tenant_id == tenant.tenant_id,
            Order.customer_email == customer_email,
        )
        .order_by(Order.created_at.desc())
    )
    result = await db.exec(stmt)
    orders = result.all()

    return list(orders)


# ── Address Book ─────────────────────────────────────────────────────


@router.get("/{tenant_slug}/customers/{customer_email}/addresses")
async def list_addresses(
    tenant_slug: str,
    customer_email: str,
    db: AsyncSession = Depends(get_db),
):
    from src.orm.models.order import CustomerAddress

    tenant = await _resolve_tenant(db, tenant_slug)
    result = await db.exec(
        select(CustomerAddress).where(
            CustomerAddress.tenant_id == tenant.tenant_id,
            CustomerAddress.customer_id == None,  # linked by email for now
        )
    )
    return [{"id": str(a.id), "line1": a.line1, "line2": a.line2, "city": a.city, "postal_code": a.postal_code, "country": a.country} for a in result.all()]


@router.post("/{tenant_slug}/customers/{customer_email}/addresses", status_code=201)
async def save_address(
    tenant_slug: str,
    customer_email: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    from src.orm.models.order import CustomerAddress

    tenant = await _resolve_tenant(db, tenant_slug)
    addr = CustomerAddress(
        tenant_id=tenant.tenant_id,
        line1=body.get("line1", ""),
        line2=body.get("line2"),
        city=body.get("city", ""),
        postal_code=body.get("postal_code", ""),
        country=body.get("country", ""),
    )
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return {"id": str(addr.id), "line1": addr.line1, "line2": addr.line2, "city": addr.city, "postal_code": addr.postal_code, "country": addr.country}


# ── Saved Payment Methods ────────────────────────────────────────────


@router.get("/{tenant_slug}/payment-methods")
async def list_payment_methods(
    tenant_slug: str,
    customer_email: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """List saved Stripe payment methods for a customer."""
    from src.services.stripe_adapter import get_stripe_adapter

    tenant = await _resolve_tenant(db, tenant_slug)
    adapter = get_stripe_adapter()
    methods = await adapter.list_payment_methods(customer_email, tenant.tenant_id)
    return methods



