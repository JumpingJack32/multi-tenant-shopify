from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, Column, Index
from sqlmodel import Field

from src.orm.base import BaseModel


class AuditLog(BaseModel, table=True):
    __tablename__ = "audit_logs"  # type: ignore
    __table_args__ = (
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
    )

    actor_user_id: Optional[UUID] = Field(default=None)
    actor_email: Optional[str] = Field(default=None, max_length=255)
    action: str = Field(max_length=100)
    resource_type: Optional[str] = Field(default=None, max_length=50)
    resource_id: Optional[str] = Field(default=None, max_length=100)
    details: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict),
    )
