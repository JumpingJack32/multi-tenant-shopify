"""Export service — streaming CSV and PDF invoice generation."""

import csv
from datetime import datetime, timezone
import io
from typing import Optional
from uuid import UUID

from fpdf import FPDF
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.order import Order, OrderItem


def _format_pence(n: int) -> str:
    return f"{n / 100:.2f}"


async def export_orders_csv(
    db: AsyncSession,
    tenant_id: UUID,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
) -> io.StringIO:
    """Stream orders as CSV. Returns a StringIO buffer."""
    stmt = (
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.tenant_id == tenant_id)
    )

    if start_date:
        stmt = stmt.where(Order.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        stmt = stmt.where(Order.created_at <= datetime.fromisoformat(end_date))
    if status:
        stmt = stmt.where(Order.status == status)

    stmt = stmt.order_by(Order.created_at.desc())
    result = await db.exec(stmt)
    orders = result.all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Order ID", "Order Number", "Date", "Customer Email",
        "Items", "Subtotal", "Tax", "Shipping", "Discount", "Total",
        "Status", "Payment Status", "Shipping Address",
    ])

    for o in orders:
        items_str = "; ".join(
            f"{i.product_name} x{i.quantity}" for i in (o.items or [])
        )
        ship = o.shipping_address or {}
        address_str = f"{ship.get('line1', '')}, {ship.get('city', '')}, {ship.get('postal_code', '')}"

        writer.writerow([
            str(o.id),
            o.order_number,
            o.created_at.strftime("%Y-%m-%d %H:%M"),
            o.customer_email or "",
            items_str,
            _format_pence(o.subtotal),
            _format_pence(o.tax),
            _format_pence(o.shipping),
            _format_pence(o.discount),
            _format_pence(o.total),
            o.status,
            o.payment_status,
            address_str,
        ])

    buffer.seek(0)
    return buffer


async def generate_invoice_pdf(
    db: AsyncSession,
    order_id: UUID,
    tenant_id: UUID,
) -> bytes:
    """Generate a PDF invoice for the given order using fpdf2."""
    order = (
        await db.exec(
            select(Order)
            .options(selectinload(Order.items))
            .where(Order.id == order_id, Order.tenant_id == tenant_id)
        )
    ).first()

    if not order:
        raise ValueError("Order not found")

    ship = order.shipping_address or {}
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, f"Invoice - {order.order_number}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, order.created_at.strftime("%B %d, %Y"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # Shipping address
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(0, 7, "Shipping Address", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    for line in [ship.get("line1"), ship.get("line2"), f'{ship.get("city", "")} {ship.get("postal_code", "")}', ship.get("country")]:
        if line:
            pdf.cell(0, 5, str(line), new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 5, f"Status: {order.status} / Payment: {order.payment_status}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 5, f"Email: {order.customer_email or ''}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # Line items table
    col_w = [60, 25, 25, 40, 40]
    headers = ["Item", "Variant", "Qty", "Unit Price", "Total"]
    pdf.set_font("Helvetica", "B", 9)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1)
    pdf.ln()

    pdf.set_font("Helvetica", "", 9)
    for item in order.items or []:
        row = [item.product_name[:40], (item.variant_name or "")[:20], str(item.quantity), f"${_format_pence(item.unit_price)}", f"${_format_pence(item.total_price)}"]
        for i, val in enumerate(row):
            pdf.cell(col_w[i], 6, val, border=1)
        pdf.ln()

    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    totals = [
        ("Subtotal:", _format_pence(order.subtotal)),
        ("Shipping:", _format_pence(order.shipping)),
        ("Tax:", _format_pence(order.tax)),
        ("Discount:", f"-{_format_pence(order.discount)}"),
        ("Total:", _format_pence(order.total)),
    ]
    for label, val in totals:
        pdf.cell(0, 6, f"{label} ${val}", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 7)
    pdf.cell(0, 5, f"Generated {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", new_x="LMARGIN", new_y="NEXT")

    return pdf.output()

