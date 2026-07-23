"""Analytics endpoints — aggregate queries over existing order data."""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import select, text as sql_text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Order, OrderItem
from src.orm.models.product import Product, Variant
from src.orm.schemas.analytics import (
    CartAbandonmentPoint,
    CategoryBreakdownResponse,
    MonthlyRetentionPoint,
    TopProductResponse,
)

router = APIRouter(tags=["analytics"])


@router.get("/top-products", response_model=list[TopProductResponse])
async def top_products(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    limit: int = Query(default=5, ge=1, le=50),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    sort_by: str = Query(default="revenue"),
):
    """Top products by revenue or units sold."""
    stmt = (
        select(
            Product.id.label("product_id"),
            Product.name.label("product_name"),
            func.min(Variant.sku).label("primary_sku"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.total_price).label("total_revenue"),
        )
        .join(Variant, OrderItem.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.tenant_id == tenant_id)
        .where(Order.status.notin_(["cancelled", "refunded"]))
    )

    if start_date:
        stmt = stmt.where(Order.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Order.created_at <= datetime.fromisoformat(end_date))

    stmt = stmt.group_by(Product.id, Product.name)

    if sort_by == "units":
        stmt = stmt.order_by(func.sum(OrderItem.quantity).desc())
    else:
        stmt = stmt.order_by(func.sum(OrderItem.total_price).desc())

    stmt = stmt.limit(limit)
    result = await db.exec(stmt)
    return [
        TopProductResponse(
            product_id=r.product_id,
            product_name=r.product_name,
            primary_sku=r.primary_sku,
            units_sold=int(r.units_sold),
            total_revenue=int(r.total_revenue),
        )
        for r in result
    ]


@router.get("/category-breakdown", response_model=list[CategoryBreakdownResponse])
async def category_breakdown(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Revenue and units sold by product category."""
    from sqlalchemy import String

    from src.orm.models.category import Category

    stmt = (
        select(
            func.coalesce(Category.id.cast(String), "uncategorized").label("category_id"),
            func.coalesce(Category.name, "Uncategorized").label("category_name"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.total_price).label("total_revenue"),
        )
        .join(Variant, OrderItem.variant_id == Variant.id)
        .join(Product, Variant.product_id == Product.id)
        .outerjoin(Category, Product.category_id == Category.id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.tenant_id == tenant_id)
        .where(Order.status.notin_(["cancelled", "refunded"]))
    )

    if start_date:
        stmt = stmt.where(Order.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Order.created_at <= datetime.fromisoformat(end_date))

    stmt = stmt.group_by(Category.id, Category.name)
    stmt = stmt.order_by(func.sum(OrderItem.total_price).desc())
    result = await db.exec(stmt)
    rows = list(result)

    total_revenue = sum(int(r.total_revenue) for r in rows) if rows else 0

    return [
        CategoryBreakdownResponse(
            category_id=str(r.category_id),
            category_name=str(r.category_name),
            units_sold=int(r.units_sold),
            total_revenue=int(r.total_revenue),
            percentage_of_total=round(int(r.total_revenue) / total_revenue * 100, 1) if total_revenue else 0.0,
        )
        for r in rows
    ]


@router.get("/customer-retention", response_model=list[MonthlyRetentionPoint])
async def customer_retention(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Monthly new vs returning customer revenue."""
    filters = "AND o.created_at >= :start" if start_date else ""
    filters += " AND o.created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    result = await db.execute(sql_text(f"""
        WITH customer_orders AS (
            SELECT c.email, o.created_at, o.total
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN customers c ON c.id = o.customer_id
            WHERE o.tenant_id = :tid AND o.status NOT IN ('cancelled', 'refunded')
            {filters}
        ),
        first_purchase AS (
            SELECT email, MIN(created_at) AS first_date
            FROM customer_orders GROUP BY email
        )
        SELECT
            to_char(DATE_TRUNC('month', co.created_at), 'YYYY-MM') AS month,
            COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.email END) AS new_customers,
            COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.email END) AS returning_customers,
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month', co.created_at) = DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END), 0) AS new_revenue,
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month', co.created_at) > DATE_TRUNC('month', fp.first_date) THEN co.total ELSE 0 END), 0) AS returning_revenue
        FROM customer_orders co
        JOIN first_purchase fp ON co.email = fp.email
        GROUP BY month ORDER BY month
    """), params)
    rows = result.all()
    return [
        MonthlyRetentionPoint(
            month=r[0], new_customers=int(r[1]), returning_customers=int(r[2]),
            new_revenue=int(r[3]), returning_revenue=int(r[4]),
        ) for r in rows
    ]


@router.get("/cart-abandonment", response_model=list[CartAbandonmentPoint])
async def cart_abandonment(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Monthly abandoned vs completed cart counts."""
    filters = "AND created_at >= :start" if start_date else ""
    filters += " AND created_at <= :end" if end_date else ""
    params: dict = {"tid": tenant_id}
    if start_date:
        params["start"] = datetime.fromisoformat(start_date)
    if end_date:
        params["end"] = datetime.fromisoformat(end_date)

    result = await db.execute(sql_text(f"""
        SELECT
            to_char(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
            COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned_carts,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_carts
        FROM carts
        WHERE tenant_id = :tid {filters}
        GROUP BY month ORDER BY month
    """), params)
    rows = result.all()
    return [
        CartAbandonmentPoint(
            month=r[0], abandoned_carts=int(r[1]), completed_carts=int(r[2]),
        ) for r in rows
    ]
