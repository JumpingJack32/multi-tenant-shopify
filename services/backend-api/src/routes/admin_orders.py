"""Admin order export endpoints — CSV and PDF."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.services.export_service import export_orders_csv, generate_invoice_pdf

router = APIRouter(tags=["admin-orders"])


@router.post("/admin/orders/export/csv")
async def export_orders_csv_endpoint(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Export filtered orders as a downloadable CSV file."""
    buffer = await export_orders_csv(db, tenant_id, start_date, end_date, status)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders-export.csv"},
    )


@router.get("/admin/orders/{order_id}/pdf")
async def generate_order_pdf(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Generate a PDF invoice for a specific order."""
    try:
        pdf_bytes = await generate_invoice_pdf(db, order_id, tenant_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Order not found")

    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice-{order_id}.pdf"},
    )
