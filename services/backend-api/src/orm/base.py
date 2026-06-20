from datetime import UTC, datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlmodel import Field, SQLModel


class BaseModel(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: Optional[UUID] = Field(default=None, index=True)
    created_at: datetime = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: datetime = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
