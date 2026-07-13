from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import Order, PaymentStatus


async def process_order_payment(
    order_id: UUID,
    payment_intent_id: str,
    db: AsyncSession = None,
) -> None:
    """Process order payment and update status."""
    if db is None:
        from src.database import create_async_db_engine
        from sqlmodel.ext.asyncio.session import AsyncSession

        async with AsyncSession(create_async_db_engine(), expire_on_commit=False) as session:
            await _process_order_payment_impl(order_id, payment_intent_id, session)
    else:
        await _process_order_payment_impl(order_id, payment_intent_id, db)


async def _process_order_payment_impl(
    order_id: UUID,
    payment_intent_id: str,
    db: AsyncSession,
) -> None:
    """Internal implementation for processing order payment."""

    stmt = select(Order).where(Order.id == order_id)
    result = await db.exec(stmt)
    order = result.one_or_none()

    if not order:
        raise ValueError(f"Order {order_id} not found")

    order.payment_status = PaymentStatus.PAID
    order.payment_intent_id = payment_intent_id

    # TODO: Queue async tasks for:
    # - Email notifications
    # - Analytics updates
    # - Inventory deduction
    # - Fulfillment queue
