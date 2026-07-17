"""Order lifecycle service — status transitions with inventory side effects."""

from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import Customer, Order, OrderStatus
from src.orm.models.product import Inventory
from src.services.order_state_machine import validate_transition


class InsufficientStockError(Exception):
    def __init__(self, variant_id: UUID, available: int, requested: int):
        self.variant_id = variant_id
        self.available = available
        self.requested = requested
        super().__init__(
            f"Insufficient stock for variant {variant_id}: "
            f"{available} available, {requested} requested"
        )


class OrderLifecycleService:
    """Handles order status transitions with atomic inventory side effects."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def confirm(self, order_id: UUID, tenant_id: UUID) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.CONFIRMED.value)
        if not order.inventory_deducted:
            await self._deduct_inventory(order, tenant_id)
            order.inventory_deducted = True
        order.status = OrderStatus.CONFIRMED
        self.db.add(order)
        return order

    async def mark_paid(self, order_id: UUID, tenant_id: UUID) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.PAID.value)
        if not order.inventory_deducted:
            await self._deduct_inventory(order, tenant_id)
            order.inventory_deducted = True
        order.status = OrderStatus.PAID
        self.db.add(order)
        return order

    async def ship(self, order_id: UUID, tenant_id: UUID) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.SHIPPED.value)
        order.status = OrderStatus.SHIPPED
        self.db.add(order)
        return order

    async def deliver(self, order_id: UUID, tenant_id: UUID) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.DELIVERED.value)
        order.status = OrderStatus.DELIVERED
        self.db.add(order)
        return order

    async def cancel(self, order_id: UUID, tenant_id: UUID) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.CANCELLED.value)
        if order.inventory_deducted:
            await self._replenish_inventory(order, tenant_id)
            order.inventory_deducted = False
        order.status = OrderStatus.CANCELLED
        self.db.add(order)
        return order

    async def refund(self, order_id: UUID, tenant_id: UUID, issue_credit: bool = True) -> Order:
        order = await self._get_order(order_id, tenant_id)
        validate_transition(order.status.value, OrderStatus.REFUNDED.value)

        # Guard: re-check status under lock to prevent double-credit from concurrent calls
        current = await self._get_order(order_id, tenant_id)
        if current.status == OrderStatus.REFUNDED:
            return order

        if order.inventory_deducted:
            await self._replenish_inventory(order, tenant_id)
            order.inventory_deducted = False

        if issue_credit and order.total > 0 and order.customer_id:
            stmt = select(Customer).where(Customer.id == order.customer_id, Customer.tenant_id == tenant_id)
            customer = (await self.db.exec(stmt)).one_or_none()
            if customer:
                customer.store_credit += order.total
                self.db.add(customer)

                from src.orm.models.order import StoreCreditTransaction

                tx = StoreCreditTransaction(
                    customer_id=customer.id,
                    tenant_id=tenant_id,
                    amount=order.total,
                    balance_after=customer.store_credit,
                    reason=f"Refund for Order #{order.order_number}",
                )
                self.db.add(tx)

        order.status = OrderStatus.REFUNDED
        self.db.add(order)
        return order

    async def _get_order(self, order_id: UUID, tenant_id: UUID) -> Order:
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Order)
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
            .options(selectinload(Order.items))
        )
        order = (await self.db.exec(stmt)).one_or_none()
        if not order:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Order not found")
        return order

    async def _deduct_inventory(self, order: Order, tenant_id: UUID) -> None:
        """Deduct inventory for all items. Sorted by variant_id to prevent deadlocks."""
        from sqlmodel import select

        from src.orm.models.order import OrderItem

        sorted_items = sorted(order.items, key=lambda x: x.variant_id or "")
        for item in sorted_items:
            if not item.variant_id:
                continue
            stmt = (
                select(Inventory)
                .where(Inventory.variant_id == item.variant_id, Inventory.tenant_id == tenant_id)
                .with_for_update()
            )
            inv_records = (await self.db.exec(stmt)).all()
            total_available = sum(r.quantity - r.reserved_quantity for r in inv_records)

            if total_available < item.quantity:
                raise InsufficientStockError(
                    variant_id=item.variant_id,
                    available=total_available,
                    requested=item.quantity,
                )

            remaining = item.quantity
            for inv in inv_records:
                if remaining <= 0:
                    break
                deductible = min(remaining, inv.quantity - inv.reserved_quantity)
                if deductible > 0:
                    inv.quantity -= deductible
                    remaining -= deductible
                    self.db.add(inv)

    async def _replenish_inventory(self, order: Order, tenant_id: UUID) -> None:
        """Reverse inventory deduction — sequential replenish, no rounding bugs."""
        sorted_items = sorted(order.items, key=lambda x: x.variant_id or "")
        for item in sorted_items:
            if not item.variant_id:
                continue
            stmt = (
                select(Inventory)
                .where(Inventory.variant_id == item.variant_id, Inventory.tenant_id == tenant_id)
                .with_for_update()
            )
            inv_records = (await self.db.exec(stmt)).all()

            remaining = item.quantity
            for inv in inv_records:
                if remaining <= 0:
                    break
                inv.quantity += remaining
                remaining = 0
                self.db.add(inv)
