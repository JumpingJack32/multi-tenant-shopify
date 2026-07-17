"""Customer address service — multi-address default management."""

from uuid import UUID

from sqlalchemy import update
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import CustomerAddress


async def set_default_shipping(db: AsyncSession, customer_id: UUID, address_id: UUID, tenant_id: UUID) -> None:
    """Set a customer address as the default shipping address.
    Clears existing defaults and syncs legacy is_default field."""
    await db.exec(
        update(CustomerAddress)
        .where(CustomerAddress.customer_id == customer_id, CustomerAddress.tenant_id == tenant_id)
        .values(is_default_shipping=False, is_default=False)
    )
    addr = await db.get(CustomerAddress, address_id)
    if addr:
        addr.is_default_shipping = True
        addr.is_default = True
        db.add(addr)


async def set_default_billing(db: AsyncSession, customer_id: UUID, address_id: UUID, tenant_id: UUID) -> None:
    """Set a customer address as the default billing address.
    Clears existing defaults and syncs legacy is_default field."""
    await db.exec(
        update(CustomerAddress)
        .where(CustomerAddress.customer_id == customer_id, CustomerAddress.tenant_id == tenant_id)
        .values(is_default_billing=False, is_default=False)
    )
    addr = await db.get(CustomerAddress, address_id)
    if addr:
        addr.is_default_billing = True
        addr.is_default = True
        db.add(addr)
