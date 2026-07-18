from datetime import datetime

from sqlalchemy import DateTime, JSON
from sqlmodel import Column, Field

from src.orm.base import BaseModel


class Event(BaseModel, table=True):
    __tablename__ = "events"  # type: ignore

    event_type: str = Field(max_length=100, index=True)
    source: str = Field(max_length=50)
    data: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    delivered: bool = Field(default=False)
    delivered_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    retry_count: int = Field(default=0)
    last_error: str | None = Field(default=None, max_length=500)
