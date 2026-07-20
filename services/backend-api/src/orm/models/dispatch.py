from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, DateTime, String, Text
from sqlmodel import Field

from src.orm.base import BaseModel


class DispatchStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class CampaignDispatch(BaseModel, table=True):
    __tablename__ = "campaign_dispatches"  # type: ignore

    name: str = Field(max_length=255)
    template_id: UUID = Field(foreign_key="campaign_templates.id", nullable=False)
    segment_id: UUID = Field(foreign_key="saved_segments.id", nullable=False)
    template_html: str = Field(sa_column=Column(Text, nullable=False))
    status: DispatchStatus = Field(default=DispatchStatus.DRAFT, index=True)
    scheduled_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), index=True),
    )
    sent_count: int = Field(default=0)
    failed_count: int = Field(default=0)
    total_count: int = Field(default=0)
    completed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True)),
    )


class CampaignDispatchRecipient(BaseModel, table=True):
    __tablename__ = "campaign_dispatch_recipients"  # type: ignore

    dispatch_id: UUID = Field(
        foreign_key="campaign_dispatches.id",
        nullable=False,
        index=True,
    )
    customer_id: Optional[UUID] = Field(
        default=None,
        foreign_key="customers.id",
    )
    email: str = Field(max_length=255)
    status: str = Field(default="pending", index=True)
    error_message: Optional[str] = Field(default=None, max_length=500)
    sent_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True)),
    )
