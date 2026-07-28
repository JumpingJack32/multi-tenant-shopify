"""Notification service — aggregates operational alerts from existing data."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, text
from sqlmodel.ext.asyncio.session import AsyncSession


async def get_notifications(db: AsyncSession, tenant_id: UUID, mark_read: list[str] | None = None) -> list[dict]:
    """Return aggregated operational alerts for the admin notification bell."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=24)
    notifications: list[dict] = []

    # Low stock: inventory_stocks where quantity <= 10
    low_stock = await db.execute(
        text("""
            SELECT v.sku, v.id, ins.quantity, n.name AS node_name
            FROM inventory_stocks ins
            JOIN variants v ON v.id = ins.variant_id
            JOIN inventory_nodes n ON n.id = ins.node_id
            WHERE ins.tenant_id = :tid AND ins.quantity <= 10
            ORDER BY ins.quantity ASC
            LIMIT 5
        """),
        {"tid": tenant_id},
    )
    for row in low_stock.all():
        notifications.append({
            "type": "low_stock",
            "severity": "warning",
            "title": f"Low Stock: {row[0]}",
            "description": f"Only {row[2]} units remaining in {row[3]}",
            "link": "/products/inventory/stock",
            "timestamp": now.isoformat(),
        })

    # Past-due subscriptions
    past_due = await db.execute(
        text("""
            SELECT cs.customer_email, cs.id
            FROM customer_subscriptions cs
            WHERE cs.tenant_id = :tid AND cs.status = 'past_due'
            LIMIT 5
        """),
        {"tid": tenant_id},
    )
    for row in past_due.all():
        notifications.append({
            "type": "subscription_past_due",
            "severity": "error",
            "title": "Subscription Payment Failed",
            "description": f"{row[0]} — payment is past due",
            "link": "/subscriptions",
            "timestamp": now.isoformat(),
        })

    # Unfulfilled paid orders older than 24h
    unfulfilled = await db.execute(
        text("""
            SELECT id, order_number, created_at
            FROM orders
            WHERE tenant_id = :tid AND status = 'paid' AND created_at < :cutoff
            ORDER BY created_at ASC
            LIMIT 5
        """),
        {"tid": tenant_id, "cutoff": cutoff},
    )
    for row in unfulfilled.all():
        notifications.append({
            "type": "unfulfilled_order",
            "severity": "warning",
            "title": f"Order {row[1]} Unfulfilled",
            "description": f"Pending for over 24 hours",
            "link": f"/orders/{row[0]}",
            "timestamp": row[2].isoformat(),
        })

    return notifications
