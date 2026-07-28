"""Refund/RMA service — Stripe refunds, store credit, inventory restock."""

from uuid import UUID

import anyio
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.inventory import InventoryStock
from src.orm.models.order import Customer, Order, OrderItem


async def process_refund(
    db: AsyncSession,
    tenant_id: UUID,
    order_id: UUID,
    refund_method: str,
    items: list[dict],
    restock: bool = False,
    warehouse_node_id: UUID | None = None,
    reason: str | None = None,
) -> Order:
    """Process a refund — Stripe API, store credit, inventory restock, order status."""
    from fastapi import HTTPException

    order = (
        await db.exec(
            select(Order)
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status in ("refunded", "cancelled"):
        raise HTTPException(status_code=400, detail="Order is already refunded or cancelled")

    total_refund = 0
    for item_req in items:
        oi = (
            await db.exec(
                select(OrderItem).where(
                    OrderItem.id == item_req["order_item_id"],
                    OrderItem.order_id == order_id,
                )
            )
        ).first()
        if not oi:
            raise HTTPException(status_code=404, detail=f"Order item {item_req['order_item_id']} not found")
        total_refund += oi.unit_price * item_req["quantity"]

    if total_refund <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be positive")

    # Stripe refund
    if refund_method == "stripe":
        if not order.payment_intent_id:
            raise HTTPException(status_code=400, detail="No Stripe payment intent on this order")

        from src.config import settings

        def _sync_refund():
            import stripe
            stripe.api_key = settings.stripe_secret_key
            return stripe.Refund.create(
                payment_intent=order.payment_intent_id,
                amount=total_refund,
            )

        await anyio.to_thread.run_sync(_sync_refund)

    # Store credit
    elif refund_method == "store_credit":
        if order.customer_id:
            customer = (
                await db.exec(
                    select(Customer).where(
                        Customer.id == order.customer_id,
                        Customer.tenant_id == tenant_id,
                    )
                )
            ).first()
            if customer:
                customer.store_credit = (customer.store_credit or 0) + total_refund
                db.add(customer)

    # Inventory restock
    if restock and warehouse_node_id:
        for item_req in items:
            oi = (
                await db.exec(
                    select(OrderItem).where(
                        OrderItem.id == item_req["order_item_id"],
                        OrderItem.order_id == order_id,
                    )
                )
            ).first()
            if oi and oi.variant_id:
                stock = (
                    await db.exec(
                        select(InventoryStock).where(
                            InventoryStock.variant_id == oi.variant_id,
                            InventoryStock.node_id == warehouse_node_id,
                            InventoryStock.tenant_id == tenant_id,
                        )
                    )
                ).first()
                if stock:
                    stock.quantity += item_req["quantity"]
                    db.add(stock)

    # Update order status
    order.status = "refunded" if total_refund >= order.total else "refunded"
    notes = f"Refunded £{total_refund / 100:.2f} via {refund_method}"
    if reason:
        notes += f" — {reason}"
    order.notes = (order.notes or "") + f"\n[{notes}]".strip()
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order
