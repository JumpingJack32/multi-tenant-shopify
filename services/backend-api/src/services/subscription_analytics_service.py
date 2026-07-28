"""Subscription analytics — MRR, churn, active subscribers, LTV."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.subscription import CustomerSubscription
from src.orm.schemas.subscription import CustomerSubscriptionResponse


async def get_subscription_metrics(db: AsyncSession, tenant_id: UUID) -> dict:
    """Return MRR, churn rate, active subscribers, and ARPU."""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    active_count = (
        await db.execute(
            select(func.count(CustomerSubscription.id)).where(
                CustomerSubscription.tenant_id == tenant_id,
                CustomerSubscription.status == "active",
            )
        )
    ).scalar() or 0

    canceled_30d = (
        await db.execute(
            select(func.count(CustomerSubscription.id)).where(
                CustomerSubscription.tenant_id == tenant_id,
                CustomerSubscription.status == "canceled",
                CustomerSubscription.updated_at >= thirty_days_ago,
            )
        )
    ).scalar() or 0

    active_before = (
        await db.execute(
            select(func.count(CustomerSubscription.id)).where(
                CustomerSubscription.tenant_id == tenant_id,
                CustomerSubscription.status == "active",
                CustomerSubscription.created_at < thirty_days_ago,
            )
        )
    ).scalar() or 0

    churn_rate = round((canceled_30d / max(active_before, 1)) * 100, 1)

    total_subscription_orders = (
        await db.execute(
            text("""
                SELECT COALESCE(SUM(total), 0) FROM orders
                WHERE tenant_id = :tid AND order_number LIKE 'SUB-%'
            """),
            {"tid": tenant_id},
        )
    ).scalar() or 0

    mrr = total_subscription_orders
    arpu = round(mrr / max(active_count, 1))

    return {
        "mrr": mrr,
        "active_subscribers": active_count,
        "churn_rate_30d": churn_rate,
        "arpu": arpu,
        "total_ltv": total_subscription_orders,
    }


async def list_subscriptions(db: AsyncSession, tenant_id: UUID) -> list:
    """Return all customer subscriptions for the tenant."""
    result = await db.exec(
        select(CustomerSubscription)
        .where(CustomerSubscription.tenant_id == tenant_id)
        .order_by(CustomerSubscription.created_at.desc())
    )
    return [
        CustomerSubscriptionResponse.model_validate(s) for s in result.all()
    ]
