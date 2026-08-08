"""Inventory service — atomic reserve/deduct/release, auto-allocate, transfers."""

from uuid import UUID

from sqlalchemy import select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.inventory import InventoryNode, InventoryStock


class InsufficientStockError(Exception):
    def __init__(self, variant_id: UUID, available: int, requested: int):
        self.variant_id = variant_id
        self.available = available
        self.requested = requested
        super().__init__(f"Insufficient stock for variant {variant_id}: requested {requested}, available {available}")


async def reserve(db: AsyncSession, variant_id: UUID, node_id: UUID, quantity: int) -> None:
    """Atomically reserve stock at a node during checkout."""
    result = await db.execute(
        text("""
            UPDATE inventory_stocks
            SET reserved = reserved + :qty
            WHERE variant_id = :v_id AND node_id = :n_id AND (quantity - reserved) >= :qty
        """),
        {"v_id": variant_id, "n_id": node_id, "qty": quantity},
    )
    if result.rowcount == 0:
        stock = (
            await db.scalars(
                select(InventoryStock).where(
                    InventoryStock.variant_id == variant_id,
                    InventoryStock.node_id == node_id,
                )
            )
        ).first()
        available = (stock.quantity - stock.reserved) if stock else 0
        raise InsufficientStockError(variant_id, available, quantity)

    await recompute_cache(db, variant_id)


async def deduct(db: AsyncSession, variant_id: UUID, node_id: UUID, quantity: int) -> None:
    """Deduct stock from a node on fulfillment shipment."""
    result = await db.execute(
        text("""
            UPDATE inventory_stocks
            SET quantity = quantity - :qty, reserved = reserved - :qty
            WHERE variant_id = :v_id AND node_id = :n_id AND reserved >= :qty
        """),
        {"v_id": variant_id, "n_id": node_id, "qty": quantity},
    )
    if result.rowcount == 0:
        raise InsufficientStockError(variant_id, 0, quantity)

    await recompute_cache(db, variant_id)


async def release(db: AsyncSession, variant_id: UUID, node_id: UUID, quantity: int) -> None:
    """Release reserved stock on order cancellation."""
    await db.execute(
        text("""
            UPDATE inventory_stocks
            SET reserved = GREATEST(0, reserved - :qty)
            WHERE variant_id = :v_id AND node_id = :n_id
        """),
        {"v_id": variant_id, "n_id": node_id, "qty": quantity},
    )
    await recompute_cache(db, variant_id)


async def auto_allocate(
    db: AsyncSession,
    tenant_id: UUID,
    variant_id: UUID,
    quantity: int,
) -> UUID | None:
    """Find the best node to fulfill an order line item.

    Priority:
    1. Active nodes
    2. Lowest priority value (primary first)
    3. Sufficient available stock (quantity - reserved >= requested)
    """
    nodes = (
        await db.scalars(
            select(InventoryNode)
            .where(
                InventoryNode.tenant_id == tenant_id,
                InventoryNode.is_active == True,
            )
            .order_by(InventoryNode.priority.asc())
        )
    ).all()

    for node in nodes:
        node_id = node.id
        stock = (
            await db.scalars(
                select(InventoryStock).where(
                    InventoryStock.variant_id == variant_id,
                    InventoryStock.node_id == node_id,
                )
            )
        ).first()

        available = (stock.quantity - stock.reserved) if stock else 0
        if available >= quantity:
            return node_id

    return None


async def recompute_cache(db: AsyncSession, variant_id: UUID) -> None:
    """Recompute Variant.inventory_quantity as sum of available stock across all nodes."""
    await db.execute(
        text("""
            UPDATE variants
            SET inventory_quantity = COALESCE(
                (SELECT SUM(quantity - reserved) FROM inventory_stocks WHERE variant_id = :v_id), 0
            )
            WHERE id = :v_id
        """),
        {"v_id": variant_id},
    )


async def create_transfer(
    db: AsyncSession,
    tenant_id: UUID,
    from_node_id: UUID,
    to_node_id: UUID,
    variant_id: UUID,
    quantity: int,
    reason: str | None = None,
) -> None:
    """Move stock between nodes in a single transaction."""
    from datetime import datetime, timezone

    from src.orm.models.inventory import InventoryTransfer as TransferModel

    # Deduct from source
    result = await db.execute(
        text("""
            UPDATE inventory_stocks
            SET quantity = quantity - :qty
            WHERE variant_id = :v_id AND node_id = :n_id AND quantity >= :qty
        """),
        {"v_id": variant_id, "n_id": from_node_id, "qty": quantity},
    )
    if result.rowcount == 0:
        raise InsufficientStockError(variant_id, 0, quantity)

    # Add to destination (upsert)
    await db.execute(
        text("""
            INSERT INTO inventory_stocks (id, tenant_id, variant_id, node_id, quantity, reserved, created_at, updated_at)
            VALUES (gen_random_uuid(), :tid, :v_id, :n_id, :qty, 0, NOW(), NOW())
            ON CONFLICT (variant_id, node_id) DO UPDATE
            SET quantity = inventory_stocks.quantity + :qty2, updated_at = NOW()
        """),
        {"tid": tenant_id, "v_id": variant_id, "n_id": to_node_id, "qty": quantity, "qty2": quantity},
    )

    transfer = TransferModel(
        tenant_id=tenant_id,
        from_node_id=from_node_id,
        to_node_id=to_node_id,
        variant_id=variant_id,
        quantity=quantity,
        status="COMPLETED",
        reason=reason,
    )
    db.add(transfer)

    await recompute_cache(db, variant_id)
