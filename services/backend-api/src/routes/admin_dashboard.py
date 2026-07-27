"""Admin dashboard metrics — revenue, fulfillments, low stock."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db

router = APIRouter(tags=["admin-dashboard"])


@router.get("/admin/dashboard/metrics")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    # Revenue current 30d
    rev_current = await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0), COUNT(*)
            FROM orders
            WHERE tenant_id = :tid AND status NOT IN ('cancelled', 'refunded', 'pending')
            AND created_at >= :start
        """),
        {"tid": tenant_id, "start": thirty_days_ago},
    )
    revenue_30d, orders_30d = rev_current.one()
    aov_30d = (revenue_30d / orders_30d) if orders_30d > 0 else 0

    # Revenue previous 30d (for trend)
    rev_prev = await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0)
            FROM orders
            WHERE tenant_id = :tid AND status NOT IN ('cancelled', 'refunded', 'pending')
            AND created_at >= :start AND created_at < :end
        """),
        {"tid": tenant_id, "start": sixty_days_ago, "end": thirty_days_ago},
    )
    revenue_prev_30d = rev_prev.scalar() or 0
    trend_pct = round(((revenue_30d - revenue_prev_30d) / max(revenue_prev_30d, 1)) * 100, 1)

    # Pending fulfillments
    pending = await db.execute(
        text("""
            SELECT COUNT(*), MIN(created_at)
            FROM orders
            WHERE tenant_id = :tid AND status = 'paid'
        """),
        {"tid": tenant_id},
    )
    pending_count, oldest_pending = pending.one()

    # Low stock items
    low_stock = await db.execute(
        text("""
            SELECT v.sku, v.sku AS variant_label, SUM(ins.quantity - ins.reserved) AS available
            FROM inventory_stocks ins
            JOIN variants v ON v.id = ins.variant_id
            WHERE ins.tenant_id = :tid
            GROUP BY v.id, v.sku
            HAVING SUM(ins.quantity - ins.reserved) <= 10 AND SUM(ins.quantity - ins.reserved) >= 0
            ORDER BY available ASC
            LIMIT 10
        """),
        {"tid": tenant_id},
    )
    low_stock_items = [
        {"sku": row[0], "label": row[1], "available": row[2]}
        for row in low_stock.all()
    ]

    return {
        "revenue_30d": revenue_30d,
        "revenue_prev_30d": revenue_prev_30d,
        "trend_pct": trend_pct,
        "orders_30d": orders_30d,
        "aov_30d": round(aov_30d),
        "pending_fulfillments": pending_count,
        "oldest_pending_date": str(oldest_pending) if oldest_pending else None,
        "low_stock_items": low_stock_items,
    }
