from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func as sa_func, text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Customer, Order
from src.orm.models.product import Product, Variant
from src.orm.models.purchase_order import PurchaseOrder
from src.orm.schemas.dashboard import (
    DashboardSummaryResponse,
    FulfillmentCounts,
    LowStockItem,
    PendingPOStats,
    RecentOrderItem,
    TimeSeriesPoint,
)

router = APIRouter(tags=["admin"])

PERIOD_MAP = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
    "12m": 365,
}


def _period_days(period: str) -> int:
    return PERIOD_MAP.get(period, 30)


async def _kpi_query(db: AsyncSession, tenant_id, start_date, prev_start, prev_end):
    query = text("""
        WITH
        mtd AS (
            SELECT
                COALESCE(SUM(COALESCE(total_base, total)), 0)::BIGINT AS revenue_mtd,
                COUNT(*)::BIGINT AS orders_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers
            FROM orders
            WHERE tenant_id = :tenant_id AND created_at >= :start_date
        ),
        net_mtd AS (
            SELECT COALESCE(SUM(COALESCE(o.total_base, o.total) - COALESCE(oi.tax_total, 0)), 0)::BIGINT AS net_revenue_mtd
            FROM orders o
            LEFT JOIN (
                SELECT order_id, SUM(tax_amount) AS tax_total
                FROM order_items WHERE tenant_id = :tenant_id
                GROUP BY order_id
            ) oi ON o.id = oi.order_id
            WHERE o.tenant_id = :tenant_id AND o.created_at >= :start_date
        ),
        prev_mtd AS (
            SELECT
                COALESCE(SUM(COALESCE(total_base, total)), 0)::BIGINT AS revenue_prev_mtd,
                COUNT(*)::BIGINT AS orders_prev_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers_prev,
                COALESCE(SUM(COALESCE(o2.total_base, o2.total) - COALESCE((
                    SELECT SUM(tax_amount) FROM order_items oi2
                    WHERE oi2.order_id = o2.id AND oi2.tenant_id = :tenant_id
                ), 0)), 0)::BIGINT AS net_revenue_prev_mtd
            FROM orders o2
            WHERE o2.tenant_id = :tenant_id
              AND o2.created_at >= :prev_start AND o2.created_at < :prev_end
        ),
        totals AS (
            SELECT
                COALESCE(SUM(COALESCE(total_base, total)), 0)::BIGINT AS revenue_total,
                COUNT(*)::BIGINT AS orders_total
            FROM orders
            WHERE tenant_id = :tenant_id
        )
        SELECT * FROM mtd, net_mtd, prev_mtd, totals
    """)
    result = await db.exec(query, params={
        "tenant_id": tenant_id,
        "start_date": start_date,
        "prev_start": prev_start,
        "prev_end": prev_end,
    })
    return dict(result.mappings().one())


async def _timeline_query(db: AsyncSession, tenant_id, start_date, days: int) -> list[TimeSeriesPoint]:
    query = text("""
        SELECT
            DATE(created_at)::text AS date,
            COALESCE(SUM(COALESCE(total_base, total)), 0)::BIGINT AS revenue,
            COUNT(*)::BIGINT AS orders
        FROM orders
        WHERE tenant_id = :tenant_id AND created_at >= :start_date
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id, "start_date": start_date})
    rows = {r.date: r for r in result.mappings().all()}

    # Zero-fill missing days
    filled = []
    for i in range(days):
        d = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        if d in rows:
            r = rows[d]
            filled.append(TimeSeriesPoint(date=d, revenue=r.revenue, orders=r.orders))
        else:
            filled.append(TimeSeriesPoint(date=d))
    return filled


async def _fulfillment_query(db: AsyncSession, tenant_id):
    stmt = select(Order).where(Order.tenant_id == tenant_id)
    orders = (await db.exec(stmt)).all()

    unfulfilled = sum(1 for o in orders if o.status.value in ("pending", "confirmed", "paid"))
    processing = sum(1 for o in orders if o.status.value == "processing")
    shipped = sum(1 for o in orders if o.status.value == "shipped")
    delivered = sum(1 for o in orders if o.status.value == "delivered")

    return FulfillmentCounts(
        unfulfilled=unfulfilled,
        processing=processing,
        shipped=shipped,
        delivered=delivered,
    )


async def _low_stock_query(db: AsyncSession, tenant_id):
    from sqlalchemy import asc

    stmt = (
        select(Variant)
        .where(Variant.tenant_id == tenant_id, Variant.inventory_quantity <= 5)
        .order_by(asc(Variant.inventory_quantity))
        .limit(20)
    )
    variants = (await db.exec(stmt)).all()

    # Batch-load product names
    product_ids = {v.product_id for v in variants if v.product_id}
    products = {}
    if product_ids:
        p_stmt = select(Product).where(Product.id.in_(product_ids))
        for p in (await db.exec(p_stmt)).all():
            products[p.id] = p.name

    return [
        LowStockItem(
            variant_id=v.id,
            product_name=products.get(v.product_id, "Unknown"),
            sku=v.sku,
            quantity=v.inventory_quantity,
            threshold=5,
        )
        for v in variants
    ]


async def _recent_orders_query(db: AsyncSession, tenant_id):
    from sqlalchemy import desc

    stmt = (
        select(Order)
        .where(Order.tenant_id == tenant_id)
        .order_by(desc(Order.created_at))
        .limit(5)
    )
    orders = (await db.exec(stmt)).all()

    # Batch-load customer names
    customer_ids = {o.customer_id for o in orders if o.customer_id}
    customers = {}
    if customer_ids:
        c_stmt = select(Customer).where(Customer.id.in_(customer_ids))
        for c in (await db.exec(c_stmt)).all():
            customers[c.id] = f"{c.first_name or ''} {c.last_name or ''}".strip() or None

    return [
        RecentOrderItem(
            id=o.id,
            order_number=o.order_number,
            customer_name=customers.get(o.customer_id) if o.customer_id else None,
            total=int(o.total),
            status=o.status.value if hasattr(o.status, "value") else o.status,
            created_at=o.created_at.isoformat() if hasattr(o.created_at, "isoformat") else str(o.created_at),
        )
        for o in orders
    ]


@router.get("/admin/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id=Depends(get_current_tenant_id),
    period: str = Query("30d", pattern="^(7d|30d|90d|12m)$"),
    # period: str = Query("30d", regex="^(7d|30d|90d|12m)$"), 👈 regex Deprecated
):
    now = datetime.now(timezone.utc)
    days = _period_days(period)
    start_date = now - timedelta(days=days)
    prev_days = days * 2
    prev_start = now - timedelta(days=prev_days)
    prev_end = start_date

    kpi = await _kpi_query(db, tenant_id, start_date, prev_start, prev_end)
    timeline = await _timeline_query(db, tenant_id, start_date, days)
    fulfillment = await _fulfillment_query(db, tenant_id)
    low_stock = await _low_stock_query(db, tenant_id)
    recent_orders = await _recent_orders_query(db, tenant_id)

    po_stmt = select(PurchaseOrder).where(
        PurchaseOrder.tenant_id == tenant_id,
        PurchaseOrder.status.in_(["draft", "pending_review"]),
    )
    po_orders = (await db.exec(po_stmt)).all()
    pending_pos = PendingPOStats(
        count=len(po_orders),
        total=sum(o.total for o in po_orders),
    )

    aov = kpi["revenue_mtd"] // kpi["orders_mtd"] if kpi["orders_mtd"] > 0 else 0

    return DashboardSummaryResponse(
        **kpi,
        aov=aov,
        fulfillment=fulfillment,
        low_stock=low_stock,
        recent_orders=recent_orders,
        pending_pos=pending_pos,
        timeline=timeline,
    )
