"""Lightweight event publisher — lazy-imports the event_bus singleton to avoid circular imports."""

from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession


def _get_event_bus():
    from src.main import event_bus
    return event_bus


async def publish(event_type: str, source: str, data: dict, tenant_id: UUID, db: AsyncSession, staged: list):
    """Publish an event through the global event bus.
    Caller must pass the staged list and call flush() after commit."""
    bus = _get_event_bus()
    if bus is None:
        return  # event bus not initialized
    await bus.publish(event_type, source, data, tenant_id, db, staged)


async def flush(staged: list):
    """Flush staged events to the in-memory queue after commit."""
    bus = _get_event_bus()
    if bus is None:
        return
    await bus.flush(staged)
