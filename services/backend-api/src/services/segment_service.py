"""Shared segment filter logic — used by both routes and background worker."""

from uuid import UUID

from sqlalchemy import func as sa_func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import Customer, CustomerAddress


async def get_customer_ids_for_filters(
    db: AsyncSession,
    tenant_id: UUID,
    filters: dict,
) -> set[UUID]:
    """Return set of customer IDs matching segment filter criteria."""
    stmt = select(Customer.id).where(Customer.tenant_id == tenant_id)

    if status := filters.get("status"):
        stmt = stmt.where(Customer.email_subscription_status == status)
    if tag := filters.get("tag"):
        stmt = stmt.where(Customer.tags[tag].as_string() == "true")
    if min_spent := filters.get("min_spent"):
        stmt = stmt.where(Customer.total_spent >= int(min_spent))
    if max_spent := filters.get("max_spent"):
        stmt = stmt.where(Customer.total_spent <= int(max_spent))
    if location := filters.get("location"):
        loc_pattern = f"%{location}%"
        stmt = stmt.where(
            Customer.addresses.any(
                CustomerAddress.city.ilike(loc_pattern) | CustomerAddress.country.ilike(loc_pattern)
            )
        )

    result = await db.exec(stmt)
    return set(result.all())


async def count_customers_for_filters(
    db: AsyncSession,
    tenant_id: UUID,
    filters: dict,
) -> int:
    """Return count of customers matching segment filter criteria."""
    stmt = select(sa_func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id)

    if status := filters.get("status"):
        stmt = stmt.where(Customer.email_subscription_status == status)
    if tag := filters.get("tag"):
        stmt = stmt.where(Customer.tags[tag].as_string() == "true")
    if min_spent := filters.get("min_spent"):
        stmt = stmt.where(Customer.total_spent >= int(min_spent))
    if max_spent := filters.get("max_spent"):
        stmt = stmt.where(Customer.total_spent <= int(max_spent))
    if location := filters.get("location"):
        loc_pattern = f"%{location}%"
        stmt = stmt.where(
            Customer.addresses.any(
                CustomerAddress.city.ilike(loc_pattern) | CustomerAddress.country.ilike(loc_pattern)
            )
        )

    result = await db.exec(stmt)
    return result.one()
