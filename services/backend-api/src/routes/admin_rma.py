"""Admin refund/RMA endpoint."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.schemas.order import OrderResponse
from src.services.rma_service import process_refund

router = APIRouter(tags=["admin-rma"])


@router.post("/admin/orders/{order_id}/refund", response_model=OrderResponse)
async def refund_order(
    order_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Issue a refund for an order — Stripe or store credit with optional restock."""
    order = await process_refund(
        db=db,
        tenant_id=tenant_id,
        order_id=order_id,
        refund_method=body.get("refund_method", "stripe"),
        items=body.get("items", []),
        restock=body.get("restock_inventory", False),
        warehouse_node_id=UUID(body["warehouse_node_id"]) if body.get("warehouse_node_id") else None,
        reason=body.get("reason"),
    )
    return order
