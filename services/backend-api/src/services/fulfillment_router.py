"""Fulfillment strategy routing for Sales Order line items.

Phase 1: pure dropshipping — always creates a PO to the supplier.
Phase 2 (deferred): can route to warehouse pick-list or split between warehouse + PO.
"""

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import OrderItem
from src.orm.models.product import Product, Variant
from src.orm.models.purchase_order import (
    OrderFulfillmentLink,
    POSequence,
    PurchaseOrder,
    PurchaseOrderItem,
)


class FulfillmentStrategy(str, enum.Enum):
    DROPSHIP = "dropship"
    WAREHOUSE = "warehouse"


async def generate_po_number(db: AsyncSession, tenant_id: UUID) -> str:
    from datetime import UTC

    now = datetime.now(UTC)
    date_prefix = now.strftime("%Y%m%d")

    stmt = (
        select(POSequence)
        .where(POSequence.tenant_id == tenant_id, POSequence.date_prefix == date_prefix)
        .with_for_update()
    )
    result = await db.exec(stmt)
    seq = result.first()

    if not seq:
        seq = POSequence(
            tenant_id=tenant_id,
            date_prefix=date_prefix,
            counter=1,
        )
        db.add(seq)
    else:
        seq.counter += 1

    await db.flush()

    import random
    import string

    rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"PO-{date_prefix}-{seq.counter:04d}-{rand_suffix}"


async def route_fulfillment(
    order_item: OrderItem,
    variant: Variant,
    tenant_id: UUID,
    db: AsyncSession,
) -> Optional[UUID]:
    """Route an order item to the appropriate fulfillment strategy.

    Phase 1: Always creates a dropship PO if the product has a supplier.
    Returns the PurchaseOrder ID, or None if no supplier is linked.
    """
    product_stmt = select(Product).where(Product.id == variant.product_id)
    result = await db.exec(product_stmt)
    product = result.one_or_none()

    if not product or not product.supplier_id:
        return None

    return await _create_dropship_po(order_item, variant, product, tenant_id, db)


async def _create_dropship_po(
    order_item: OrderItem,
    variant: Variant,
    product: Product,
    tenant_id: UUID,
    db: AsyncSession,
) -> UUID:
    """Create a dropship PurchaseOrder for a single order item."""
    po_number = await generate_po_number(db, tenant_id)

    po = PurchaseOrder(
        tenant_id=tenant_id,
        po_number=po_number,
        supplier_id=product.supplier_id,
        status="pending_review",
        fulfillment_strategy=FulfillmentStrategy.DROPSHIP.value,
        subtotal=0,
        total=0,
        notes="Auto-generated from Sales Order item",
    )
    db.add(po)
    await db.flush()

    unit_cost = variant.cost_price or 0
    quantity = order_item.quantity
    subtotal = unit_cost * quantity

    po_item = PurchaseOrderItem(
        tenant_id=tenant_id,
        purchase_order_id=po.id,
        variant_id=variant.id,
        supplier_sku=variant.supplier_sku,
        product_name=product.name or order_item.product_name,
        variant_label=order_item.variant_name or "",
        quantity=quantity,
        unit_cost=unit_cost,
        subtotal=subtotal,
    )
    db.add(po_item)
    await db.flush()

    link = OrderFulfillmentLink(
        tenant_id=tenant_id,
        order_item_id=order_item.id,
        purchase_order_item_id=po_item.id,
        quantity=quantity,
    )
    db.add(link)
    await db.flush()

    po.subtotal = subtotal
    po.total = subtotal
    db.add(po)

    return po.id


async def group_and_route(
    order_items: list[OrderItem],
    tenant_id: UUID,
    db: AsyncSession,
) -> dict[str, list[UUID]]:
    """Group order items by supplier and route each group.

    Returns a dict with:
      - "po_ids": list of created PurchaseOrder UUIDs
      - "sourced_item_ids": list of OrderItem IDs that were successfully sourced
      - "unsourced_item_ids": list of OrderItem IDs with no supplier linked
    """
    po_ids: list[UUID] = []
    sourced_item_ids: list[UUID] = []
    unsourced_item_ids: list[UUID] = []

    for item in order_items:
        v_stmt = select(Variant).where(Variant.id == item.variant_id)
        result = await db.exec(v_stmt)
        variant = result.one_or_none()
        if not variant:
            unsourced_item_ids.append(item.id)
            continue

        po_id = await route_fulfillment(item, variant, tenant_id, db)
        if po_id:
            po_ids.append(po_id)
            sourced_item_ids.append(item.id)
        else:
            unsourced_item_ids.append(item.id)

    return {
        "po_ids": list(set(po_ids)),
        "sourced_item_ids": sourced_item_ids,
        "unsourced_item_ids": unsourced_item_ids,
    }
