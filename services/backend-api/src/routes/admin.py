from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.schemas.dashboard import (
    DashboardSummaryResponse,
    FulfillmentCounts,
    LowStockItem,
    RecentOrderItem,
)

router = APIRouter(tags=["admin"])


async def _kpi_query(db: AsyncSession, tenant_id: UUID) -> dict:
    query = text("""
        WITH
        mtd AS (
            SELECT
                COALESCE(SUM(total), 0)::BIGINT AS revenue_mtd,
                COUNT(*)::BIGINT AS orders_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers
            FROM orders
            WHERE tenant_id = :tenant_id
              AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        ),
        prev_mtd AS (
            SELECT
                COALESCE(SUM(total), 0)::BIGINT AS revenue_prev_mtd,
                COUNT(*)::BIGINT AS orders_prev_mtd,
                COUNT(DISTINCT customer_id)::BIGINT AS active_customers_prev
            FROM orders
            WHERE tenant_id = :tenant_id
              AND created_at >= date_trunc('month', CURRENT_TIMESTAMP - INTERVAL '1 month')
              AND created_at < date_trunc('month', CURRENT_TIMESTAMP)
        ),
        totals AS (
            SELECT
                COALESCE(SUM(total), 0)::BIGINT AS revenue_total,
                COUNT(*)::BIGINT AS orders_total
            FROM orders
            WHERE tenant_id = :tenant_id
        )
        SELECT * FROM mtd, prev_mtd, totals
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return dict(result.mappings().one())


async def _fulfillment_query(db: AsyncSession, tenant_id: UUID) -> FulfillmentCounts:
    query = text("""
        SELECT
            COALESCE(SUM(CASE WHEN status IN ('PENDING', 'CONFIRMED', 'PAID') THEN 1 ELSE 0 END), 0)::BIGINT AS unfulfilled,
            COALESCE(SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END), 0)::BIGINT AS processing,
            COALESCE(SUM(CASE WHEN status = 'SHIPPED' THEN 1 ELSE 0 END), 0)::BIGINT AS shipped,
            COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0)::BIGINT AS delivered
        FROM orders
        WHERE tenant_id = :tenant_id
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return FulfillmentCounts(**dict(result.mappings().one()))


async def _low_stock_query(db: AsyncSession, tenant_id: UUID) -> list[LowStockItem]:
    query = text("""
        SELECT
            v.id AS variant_id,
            p.name AS product_name,
            v.sku,
            v.inventory_quantity AS quantity,
            5 AS threshold
        FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE v.tenant_id = :tenant_id AND v.inventory_quantity <= 5
        ORDER BY v.inventory_quantity ASC
        LIMIT 20
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return [LowStockItem(**row) for row in result.mappings().all()]


async def _recent_orders_query(db: AsyncSession, tenant_id: UUID) -> list[RecentOrderItem]:
    query = text("""
        SELECT
            o.id,
            o.order_number,
            CASE WHEN c.first_name IS NOT NULL OR c.last_name IS NOT NULL
                THEN TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, ''))
                ELSE NULL
            END AS customer_name,
            o.total::BIGINT AS total,
            o.status::text AS status,
            o.created_at::text AS created_at
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.tenant_id = :tenant_id
        ORDER BY o.created_at DESC
        LIMIT 5
    """)
    result = await db.exec(query, params={"tenant_id": tenant_id})
    return [RecentOrderItem(**row) for row in result.mappings().all()]


@router.get("/admin/dashboard/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    kpi = await _kpi_query(db, tenant_id)
    fulfillment = await _fulfillment_query(db, tenant_id)
    low_stock = await _low_stock_query(db, tenant_id)
    recent_orders = await _recent_orders_query(db, tenant_id)

    aov = kpi["revenue_mtd"] // kpi["orders_mtd"] if kpi["orders_mtd"] > 0 else 0

    return DashboardSummaryResponse(
        **kpi,
        aov=aov,
        fulfillment=fulfillment,
        low_stock=low_stock,
        recent_orders=recent_orders,
    )
