from datetime import datetime, timezone
from typing import Optional
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import selectinload
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.product import Location, Variant
from src.orm.models.stock_transfer import StockTransfer, StockTransferItem
from src.orm.schemas.stock_transfer import (
    PaginationMeta,
    TransferCreateInput,
    TransferItemResponse,
    TransferListResponse,
    TransferPatchInput,
    TransferResponse,
)
from src.services.transfer_state_machine import TransferStateError, validate_transition

router = APIRouter()


def _generate_transfer_number() -> str:
    return f"TR-{uuid.uuid4().hex[:8].upper()}"


async def _build_response(db: AsyncSession, transfer: StockTransfer) -> TransferResponse:
    origin = await db.get(Location, transfer.origin_location_id)
    dest = await db.get(Location, transfer.destination_location_id)

    items_result = await db.exec(
        select(StockTransferItem)
        .options(selectinload(StockTransferItem.variant))
        .where(StockTransferItem.transfer_id == transfer.id)
    )
    items = items_result.all()

    item_responses = []
    for item in items:
        v = item.variant
        item_responses.append(TransferItemResponse(
            id=item.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            received_quantity=item.received_quantity,
            sku=v.sku if v else "",
            product_name=v.product.name if v and v.product else "Unknown",
        ))

    return TransferResponse(
        id=transfer.id,
        tenant_id=transfer.tenant_id,
        transfer_number=transfer.transfer_number,
        origin_location_id=transfer.origin_location_id,
        destination_location_id=transfer.destination_location_id,
        origin_location_name=origin.name if origin else "Unknown",
        destination_location_name=dest.name if dest else "Unknown",
        status=transfer.status,
        estimated_arrival=transfer.estimated_arrival,
        carrier=transfer.carrier,
        tracking_number=transfer.tracking_number,
        reference_number=transfer.reference_number,
        notes=transfer.notes,
        sent_at=transfer.sent_at,
        completed_at=transfer.completed_at,
        cancelled_at=transfer.cancelled_at,
        items=item_responses,
        created_at=transfer.created_at,
        updated_at=transfer.updated_at,
    )


@router.get("/stock-transfers", response_model=TransferListResponse)
async def list_transfers(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    base = select(StockTransfer).where(StockTransfer.tenant_id == tenant_id)

    if status_filter:
        base = base.where(StockTransfer.status == status_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total_result = await db.exec(count_stmt)
    total = total_result.one()

    stmt = base.order_by(StockTransfer.created_at.desc())
    result = await db.exec(stmt.offset((page - 1) * page_size).limit(page_size))
    transfers = result.all()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    data = [await _build_response(db, t) for t in transfers]

    return TransferListResponse(
        data=data,
        pagination=PaginationMeta(
            page=page, page_size=page_size, total=total, total_pages=total_pages,
        ),
    )


@router.post("/stock-transfers", response_model=TransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    data: TransferCreateInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    if not data.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    origin = await db.get(Location, data.origin_location_id)
    if not origin or origin.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Origin location not found")
    dest = await db.get(Location, data.destination_location_id)
    if not dest or dest.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Destination location not found")
    if data.origin_location_id == data.destination_location_id:
        raise HTTPException(status_code=400, detail="Origin and destination must differ")

    transfer = StockTransfer(
        transfer_number=_generate_transfer_number(),
        tenant_id=tenant_id,
        origin_location_id=data.origin_location_id,
        destination_location_id=data.destination_location_id,
        estimated_arrival=data.estimated_arrival,
        carrier=data.carrier,
        tracking_number=data.tracking_number,
        reference_number=data.reference_number,
        notes=data.notes,
    )
    db.add(transfer)
    await db.flush()

    for item in data.items:
        variant = await db.get(Variant, item.variant_id)
        if not variant or variant.tenant_id != tenant_id:
            raise HTTPException(status_code=404, detail=f"Variant {item.variant_id} not found")

        transfer_item = StockTransferItem(
            transfer_id=transfer.id,
            tenant_id=tenant_id,
            variant_id=item.variant_id,
            quantity=item.quantity,
        )
        db.add(transfer_item)

    await db.flush()
    await db.refresh(transfer)
    return await _build_response(db, transfer)


@router.get("/stock-transfers/{transfer_id}", response_model=TransferResponse)
async def get_transfer(
    transfer_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.tenant_id == tenant_id,
        )
    )
    transfer = result.one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return await _build_response(db, transfer)


@router.patch("/stock-transfers/{transfer_id}", response_model=TransferResponse)
async def patch_transfer(
    transfer_id: UUID,
    data: TransferPatchInput,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.tenant_id == tenant_id,
        )
    )
    transfer = result.one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] != transfer.status:
        try:
            validate_transition(transfer.status, update_data["status"])
        except TransferStateError as e:
            raise HTTPException(status_code=422, detail=e.message)

        now = datetime.now(timezone.utc)
        if update_data["status"] == "sent" and transfer.sent_at is None:
            transfer.sent_at = now
        if update_data["status"] == "completed" and transfer.completed_at is None:
            transfer.completed_at = now
        if update_data["status"] == "cancelled" and transfer.cancelled_at is None:
            transfer.cancelled_at = now

    for key, value in update_data.items():
        setattr(transfer, key, value)

    await db.flush()
    await db.refresh(transfer)
    return await _build_response(db, transfer)


@router.delete("/stock-transfers/{transfer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transfer(
    transfer_id: UUID,
    tenant_id: UUID = Depends(get_current_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.exec(
        select(StockTransfer).where(
            StockTransfer.id == transfer_id,
            StockTransfer.tenant_id == tenant_id,
        )
    )
    transfer = result.one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if transfer.status not in ("draft", "cancelled"):
        raise HTTPException(status_code=400, detail="Can only delete draft or cancelled transfers")

    await db.delete(transfer)
    await db.flush()
