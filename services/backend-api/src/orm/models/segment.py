from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import DateTime, JSON
from sqlmodel import Column, Field, Relationship

from src.orm.base import BaseModel


class SavedSegment(BaseModel, table=True):
    __tablename__ = "saved_segments"  # type: ignore

    name: str = Field(max_length=255)
    filters: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    customer_count: int = Field(default=0)
    is_automated: bool = Field(default=False)
    campaign_template_id: UUID | None = Field(default=None, foreign_key="campaign_templates.id")

    memberships: list["CustomerSegmentMembership"] = Relationship(
        back_populates="segment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class CustomerSegmentMembership(BaseModel, table=True):
    __tablename__ = "customer_segment_memberships"  # type: ignore

    customer_id: UUID = Field(foreign_key="customers.id", primary_key=True)
    segment_id: UUID = Field(foreign_key="saved_segments.id", primary_key=True)
    joined_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )

    segment: SavedSegment = Relationship(back_populates="memberships")
