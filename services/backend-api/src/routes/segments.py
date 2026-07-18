from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.segment import SavedSegment
from src.orm.schemas.segment import (
    SegmentCreate,
    SegmentResponse,
    SegmentToggleAutomation,
    SegmentUpdate,
)
from src.services.segment_service import count_customers_for_filters

router = APIRouter(tags=["segments"])


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
    count = await count_customers_for_filters(db, tenant_id, body.filters)
    segment = SavedSegment(
        tenant_id=tenant_id,
        name=body.name,
        filters=body.filters,
        customer_count=count,
        mailchimp_tag=body.mailchimp_tag,
        is_automated=body.is_automated,
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
        segment.customer_count = await count_customers_for_filters(db, tenant_id, body.filters)

    db.add(segment)
    await db.flush()
    await db.refresh(segment)
    return segment


@router.put("/segments/{segment_id}/automate", response_model=SegmentResponse)
async def toggle_segment_automation(
    segment_id: UUID,
    body: SegmentToggleAutomation,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(SavedSegment).where(SavedSegment.id == segment_id, SavedSegment.tenant_id == tenant_id)
    segment = (await db.exec(stmt)).one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    segment.is_automated = body.is_automated
    segment.mailchimp_tag = body.mailchimp_tag
    segment.campaign_template_id = body.campaign_template_id
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
