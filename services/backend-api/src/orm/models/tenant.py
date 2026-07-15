from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SAEnum, Index, JSON, UniqueConstraint
from sqlmodel import Column, Field, SQLModel

from src.orm.base import BaseModel


class TenantStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class Tenant(SQLModel, table=True):
    __tablename__ = "tenants" # type: ignore
    __table_args__ = (
        Index("ix_tenants_slug", "slug", unique=True),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(default_factory=uuid4, unique=True, index=True)
    name: str = Field(max_length=255)
    slug: str = Field(max_length=100, unique=True)
    domain: Optional[str] = Field(default=None, max_length=255)
    plan: str = Field(default="starter", max_length=50)
    status: TenantStatus = Field(
    default=TenantStatus.PENDING,
    sa_column=Column(SAEnum(TenantStatus))
)
    settings: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict, comment="Tenant settings JSON"),
    )
    options: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict, comment="Tenant options JSON"),
    )
    trial_ends_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
    subscription_id: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())


class TenantUser(SQLModel, table=True):
    __tablename__ = "tenant_users" # type: ignore
    __table_args__ = (
        Index("ix_tenant_users_tenant_clerk_id", "tenant_id", "clerk_user_id"),
        UniqueConstraint("tenant_id", "clerk_user_id", name="uq_tenant_users_tenant_clerk_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", ondelete="CASCADE")
    clerk_user_id: str = Field(default="", max_length=255)
    email: str = Field(max_length=255)
    password_hash: str = Field(max_length=255)
    role: str = Field(default="member", max_length=50)
    is_active: bool = Field(default=True)
    is_platform_superuser: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())


class ClerkWebhookEvent(BaseModel, table=True):
    __tablename__ = "clerk_webhook_events" # type: ignore

    event_id: str = Field(max_length=255, unique=True)
    event_type: str = Field(max_length=100)
    data: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict, comment="Webhook event data JSON"),
    )
    processed: bool = Field(default=False)
    processed_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
