from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, JSON
from sqlmodel import Column, Field

from src.orm.base import BaseModel


class WebhookSubscriber(BaseModel, table=True):
    __tablename__ = "webhook_subscribers"  # type: ignore

    url: str = Field(max_length=2048)
    secret: str | None = Field(default=None, max_length=255)
    event_types: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False, default=list))
    is_active: bool = Field(default=True)
    last_sent_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    last_status_code: int | None = None


class WebhookDeliveryAttempt(BaseModel, table=True):
    __tablename__ = "webhook_delivery_attempts"  # type: ignore

    event_id: UUID = Field(foreign_key="events.id", index=True)
    subscriber_id: UUID = Field(foreign_key="webhook_subscribers.id", index=True)
    status_code: int | None = None
    success: bool = Field(default=False)
    error_message: str | None = Field(default=None, max_length=500)
