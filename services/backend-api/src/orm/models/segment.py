from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import JSON
from sqlmodel import Column, Field, Relationship

from src.orm.base import BaseModel


class SavedSegment(BaseModel, table=True):
    __tablename__ = "saved_segments"  # type: ignore

    name: str = Field(max_length=255)
    filters: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    customer_count: int = Field(default=0)
    mailchimp_tag: str | None = Field(default=None, max_length=100)
    is_automated: bool = Field(default=False)

    memberships: list["CustomerSegmentMembership"] = Relationship(
        back_populates="segment",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class CustomerSegmentMembership(BaseModel, table=True):
    __tablename__ = "customer_segment_memberships"  # type: ignore

    customer_id: UUID = Field(foreign_key="customers.id", primary_key=True)
    segment_id: UUID = Field(foreign_key="saved_segments.id", primary_key=True)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    segment: SavedSegment = Relationship(back_populates="memberships")
