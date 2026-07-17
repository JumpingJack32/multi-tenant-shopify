"""Fulfillment service — create/cancel/track packages for orders."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func as sa_func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.fulfillment import Fulfillment, FulfillmentItem, FulfillmentStatus
from src.orm.models.order import Order, OrderItem


class FulfillmentService:
    """Transactional fulfillment operations with over-fulfillment protection."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_fulfillment(
        self,
        tenant_id: UUID,
        order_id: UUID,
        items_to_pack: list[dict],
        carrier: str | None = None,
        tracking_number: str | None = None,
    ) -> Fulfillment:
        stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id).with_for_update()
        order = (await self.db.exec(stmt)).one_or_none()
        if not order:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Order not found")

        # Validate remaining quantities against already-packed items
        packed = await self._get_packed_quantities(tenant_id, order_id)
        for item_req in items_to_pack:
            oi_id = item_req["order_item_id"]
            requested = item_req["quantity"]
            ordered = packed.get(oi_id, {}).get("ordered", 0)
            already_packed = packed.get(oi_id, {}).get("packed", 0)
            remaining = ordered - already_packed
            if requested > remaining:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=422,
                    detail=f"Over-fulfillment for item {oi_id}: requested {requested}, remaining {remaining}",
                )

        fulfillment = Fulfillment(
            tenant_id=tenant_id,
            order_id=order_id,
            carrier=carrier,
            tracking_number=tracking_number,
        )
        self.db.add(fulfillment)
        await self.db.flush()

        for item_req in items_to_pack:
            fi = FulfillmentItem(
                fulfillment_id=fulfillment.id,
                order_item_id=item_req["order_item_id"],
                quantity=item_req["quantity"],
            )
            self.db.add(fi)

        await self.db.flush()
        await self.db.refresh(fulfillment)
        return fulfillment

    async def cancel_fulfillment(self, tenant_id: UUID, fulfillment_id: UUID) -> Fulfillment:
        stmt = select(Fulfillment).where(Fulfillment.id == fulfillment_id, Fulfillment.tenant_id == tenant_id)
        f = (await self.db.exec(stmt)).one_or_none()
        if not f:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Fulfillment not found")
        if f.status in (FulfillmentStatus.TRANSIT, FulfillmentStatus.DELIVERED):
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"Cannot cancel a package that is already {f.status.value}")
        f.status = FulfillmentStatus.CANCELLED
        self.db.add(f)
        return f

    async def update_tracking(
        self,
        tenant_id: UUID,
        fulfillment_id: UUID,
        carrier: str,
        tracking_number: str,
        status: str,
    ) -> Fulfillment:
        stmt = select(Fulfillment).where(Fulfillment.id == fulfillment_id, Fulfillment.tenant_id == tenant_id)
        f = (await self.db.exec(stmt)).one_or_none()
        if not f:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Fulfillment not found")
        f.carrier = carrier
        f.tracking_number = tracking_number
        f.status = FulfillmentStatus(status)
        if f.status == FulfillmentStatus.TRANSIT:
            f.shipped_at = datetime.now(timezone.utc)
        elif f.status == FulfillmentStatus.DELIVERED:
            f.delivered_at = datetime.now(timezone.utc)
        self.db.add(f)
        return f

    async def _get_packed_quantities(self, tenant_id: UUID, order_id: UUID) -> dict:
        """Return {order_item_id: {"ordered": int, "packed": int}} for validation."""
        from sqlmodel import func

        # Get ordered quantities
        oi_stmt = select(OrderItem).where(OrderItem.tenant_id == tenant_id)
        order_items_list = (await self.db.exec(oi_stmt)).all()

        # Get packed quantities across all non-cancelled fulfillments
        packed_stmt = (
            select(FulfillmentItem.order_item_id, sa_func.sum(FulfillmentItem.quantity).label("packed"))
            .join(Fulfillment)
            .where(
                Fulfillment.order_id == order_id,
                Fulfillment.tenant_id == tenant_id,
                Fulfillment.status != FulfillmentStatus.CANCELLED,
            )
            .group_by(FulfillmentItem.order_item_id)
        )
        packed_rows = (await self.db.exec(packed_stmt)).all()
        packed_map = {r.order_item_id: r.packed for r in packed_rows}

        result = {}
        for oi in order_items_list:
            result[oi.id] = {
                "ordered": oi.quantity,
                "packed": packed_map.get(oi.id, 0),
            }
        return result
