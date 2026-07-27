from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import UniqueConstraint
from sqlmodel import Field

from src.orm.base import BaseModel


class Promotion(BaseModel, table=True):
    __tablename__ = "promotions"  # type: ignore
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_promotion_tenant_code"),
    )

    code: str = Field(max_length=50, index=True)
    type: str = Field(max_length=20)
    value: int = Field(ge=0)
    min_subtotal: Optional[int] = Field(default=None, ge=0)
    max_uses: Optional[int] = Field(default=None, ge=0)
    uses_count: int = Field(default=0)
    starts_at: Optional[datetime] = Field(default=None)
    ends_at: Optional[datetime] = Field(default=None)
    is_active: bool = Field(default=True)
