from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
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
                COALESCE(SUM(total), 0)::BIGINT AS revenue_mtd,
                COUNT(*)::BIGINT AS orders_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers
            FROM orders
            WHERE tenant_id = :tenant_id AND created_at >= :start_date
        ),
        net_mtd AS (
            SELECT COALESCE(SUM(o.total - COALESCE(oi.tax_total, 0)), 0)::BIGINT AS net_revenue_mtd
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
                COALESCE(SUM(total), 0)::BIGINT AS revenue_prev_mtd,
                COUNT(*)::BIGINT AS orders_prev_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers_prev,
                COALESCE(SUM(total - COALESCE((
                    SELECT SUM(tax_amount) FROM order_items oi2
                    WHERE oi2.order_id = orders.id AND oi2.tenant_id = :tenant_id
                ), 0)), 0)::BIGINT AS net_revenue_prev_mtd
            FROM orders
            WHERE tenant_id = :tenant_id
              AND created_at >= :prev_start AND created_at < :prev_end
        ),
        totals AS (
            SELECT
                COALESCE(SUM(total), 0)::BIGINT AS revenue_total,
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
            COALESCE(SUM(total), 0)::BIGINT AS revenue,
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
    query = text("""
        SELECT
            COALESCE(SUM(CASE WHEN LOWER(status::text) IN ('pending','confirmed','paid') THEN 1 ELSE 0 END), 0)::BIGINT AS unfulfilled,
            COALESCE(SUM(CASE WHEN LOWER(status::text) = 'processing' THEN 1 ELSE 0 END), 0)::BIGINT AS processing,
            COALESCE(SUM(CASE WHEN LOWER(status::text) = 'shipped' THEN 1 ELSE 0 END), 0)::BIGINT AS shipped,
            COALESCE(SUM(CASE WHEN LOWER(status::text) = 'delivered' THEN 1 ELSE 0 END), 0)::BIGINT AS delivered
        FROM orders WHERE tenant_id = :tenant_id
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return FulfillmentCounts(**dict(result.mappings().one()))


async def _low_stock_query(db: AsyncSession, tenant_id):
    query = text("""
        SELECT
            v.id AS variant_id, p.name AS product_name, v.sku,
            v.inventory_quantity AS quantity, 5 AS threshold
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.tenant_id = :tenant_id AND v.inventory_quantity <= 5
        ORDER BY v.inventory_quantity ASC LIMIT 20
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return [LowStockItem(**row) for row in result.mappings().all()]


async def _recent_orders_query(db: AsyncSession, tenant_id):
    query = text("""
        SELECT
            o.id, o.order_number,
            CASE WHEN c.first_name IS NOT NULL OR c.last_name IS NOT NULL
                THEN TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,''))
                ELSE NULL
            END AS customer_name,
            o.total::BIGINT AS total, LOWER(o.status::text) AS status,
            o.created_at::text AS created_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.tenant_id = :tenant_id
        ORDER BY o.created_at DESC LIMIT 5
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return [RecentOrderItem(**row) for row in result.mappings().all()]


@router.get("/admin/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id=Depends(get_current_tenant_id),
    period: str = Query("30d", regex="^(7d|30d|90d|12m)$"),
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

    po_query = text("""
        SELECT COUNT(*)::BIGINT AS count, COALESCE(SUM(total),0)::BIGINT AS total
        FROM purchase_orders
        WHERE tenant_id = :tenant_id AND status IN ('draft','pending_review')
    """)
    po_result = await db.exec(po_query, params={"tenant_id": tenant_id})
    po_row = po_result.mappings().first()
    pending_pos = PendingPOStats(count=po_row["count"], total=po_row["total"])

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
