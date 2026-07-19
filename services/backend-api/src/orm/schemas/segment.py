from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class SegmentCreate(PydanticBaseModel):
    name: str = Field(..., max_length=255)
    filters: dict = Field(default_factory=dict)
    is_automated: bool = False


class SegmentUpdate(PydanticBaseModel):
    name: Optional[str] = Field(None, max_length=255)
    filters: Optional[dict] = None


class SegmentToggleAutomation(PydanticBaseModel):
    is_automated: bool
    campaign_template_id: Optional[UUID] = None


class SegmentResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    filters: dict = {}
    customer_count: int = 0
    is_automated: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
