from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sa_func, or_
from sqlmodel import select

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.order import Customer, CustomerAddress
from src.orm.models.segment import SavedSegment
from src.orm.schemas.segment import SegmentCreate, SegmentResponse, SegmentUpdate

router = APIRouter(tags=["segments"])


async def _count_customers_for_filters(
    db,
    tenant_id: UUID,
    filters: dict,
) -> int:
    """Reuse Phase 1 filter logic to count matching customers for a segment."""
    stmt = select(sa_func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id)

    if status := filters.get("status"):
        stmt = stmt.where(Customer.email_subscription_status == status)
    if tag := filters.get("tag"):
        stmt = stmt.where(Customer.tags[tag].as_string() == "true")
    if min_spent := filters.get("min_spent"):
        stmt = stmt.where(Customer.total_spent >= int(min_spent))
    if max_spent := filters.get("max_spent"):
        stmt = stmt.where(Customer.total_spent <= int(max_spent))
    if location := filters.get("location"):
        loc_pattern = f"%{location}%"
        stmt = stmt.where(
            Customer.addresses.any(
                CustomerAddress.city.ilike(loc_pattern) | CustomerAddress.country.ilike(loc_pattern)
            )
        )

    result = await db.exec(stmt)
    return result.one()


@router.get("/segments/", response_model=list[SegmentResponse])
async def list_segments(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(SavedSegment).where(SavedSegment.tenant_id == tenant_id).order_by(SavedSegment.name)
    segments = (await db.exec(stmt)).all()
    return [SegmentResponse.model_validate(s) for s in segments]


@router.post("/segments/", response_model=SegmentResponse, status_code=201)
async def create_segment(
    body: SegmentCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    count = await _count_customers_for_filters(db, tenant_id, body.filters)
    segment = SavedSegment(
        tenant_id=tenant_id,
        name=body.name,
        filters=body.filters,
        customer_count=count,
    )
    db.add(segment)
    await db.flush()
    await db.refresh(segment)
    return segment


@router.put("/segments/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: UUID,
    body: SegmentUpdate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(SavedSegment).where(SavedSegment.id == segment_id, SavedSegment.tenant_id == tenant_id)
    segment = (await db.exec(stmt)).one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    if body.name is not None:
        segment.name = body.name
    if body.filters is not None:
        segment.filters = body.filters
        segment.customer_count = await _count_customers_for_filters(db, tenant_id, body.filters)

    db.add(segment)
    await db.flush()
    await db.refresh(segment)
    return segment


@router.delete("/segments/{segment_id}", status_code=204)
async def delete_segment(
    segment_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(SavedSegment).where(SavedSegment.id == segment_id, SavedSegment.tenant_id == tenant_id)
    segment = (await db.exec(stmt)).one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    await db.delete(segment)
