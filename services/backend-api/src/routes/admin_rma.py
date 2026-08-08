"""Admin refund/RMA endpoint."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_user, get_db
from src.orm.models.tenant import TenantUser
from src.orm.schemas.order import OrderResponse
from src.services.audit_service import record_audit
from src.services.rma_service import process_refund

router = APIRouter(tags=["admin-rma"])


@router.post("/admin/orders/{order_id}/refund", response_model=OrderResponse)
async def refund_order(
    order_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    actor: TenantUser = Depends(get_current_tenant_user),
):
    """Issue a refund for an order — Stripe or store credit with optional restock."""
    refund_method = body.get("refund_method", "stripe")
    order = await process_refund(
        db=db,
        tenant_id=actor.tenant_id,
        order_id=order_id,
        refund_method=refund_method,
        items=body.get("items", []),
        restock=body.get("restock_inventory", False),
        warehouse_node_id=UUID(body["warehouse_node_id"]) if body.get("warehouse_node_id") else None,
        reason=body.get("reason"),
    )

    action = "store_credit.issue" if refund_method == "store_credit" else "orders.refund"
    record_audit(
        tenant_id=actor.tenant_id,
        actor_user_id=actor.id,
        actor_email=actor.email,
        action=action,
        resource_type="order",
        resource_id=str(order_id),
        details={
            "method": refund_method,
            "reason": body.get("reason"),
            "order_number": getattr(order, "order_number", None),
        },
    )
    return order
