from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class DispatchCreate(BaseModel):
    name: str = Field(..., max_length=255)
    template_id: UUID
    segment_id: UUID
    scheduled_at: Optional[datetime] = None
    send_immediately: bool = False


class DispatchScheduleRequest(BaseModel):
    scheduled_at: datetime


class DispatchResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    template_id: UUID
    segment_id: UUID
    status: str
    scheduled_at: Optional[datetime] = None
    sent_count: int
    failed_count: int
    total_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DispatchListResponse(BaseModel):
    data: list[DispatchResponse]
    total: int
    page: int
    per_page: int
