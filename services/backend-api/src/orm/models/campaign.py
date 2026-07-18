from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Text
from sqlmodel import Column, Field

from src.orm.base import BaseModel


class CampaignTemplate(BaseModel, table=True):
    __tablename__ = "campaign_templates"  # type: ignore

    name: str = Field(max_length=255)
    subject: str = Field(max_length=255)
    body_html: str = Field(sa_column=Column(Text, nullable=False))
    body_json: Optional[str] = Field(default=None, sa_column=Column(Text))
    mailchimp_tag: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = Field(default=False)
    send_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    send_recurrence: Optional[str] = Field(default=None, max_length=20)
    last_sent_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
