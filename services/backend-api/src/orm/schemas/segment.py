from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field, model_validator


class SegmentCreate(PydanticBaseModel):
    name: str = Field(..., max_length=255)
    filters: dict = Field(default_factory=dict)
    mailchimp_tag: Optional[str] = Field(None, max_length=100)
    is_automated: bool = False


class SegmentUpdate(PydanticBaseModel):
    name: Optional[str] = Field(None, max_length=255)
    filters: Optional[dict] = None


class SegmentToggleAutomation(PydanticBaseModel):
    is_automated: bool
    mailchimp_tag: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="after")
    def validate_automation(self):
        if self.is_automated and not self.mailchimp_tag:
            raise ValueError("A Mailchimp tag is required to enable automation.")
        return self


class SegmentResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    filters: dict = {}
    customer_count: int = 0
    mailchimp_tag: Optional[str] = None
    is_automated: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
