from typing import Optional

from sqlalchemy import Column, Index, JSON
from sqlmodel import Field

from src.orm.base import BaseModel


class SaaSPlan(BaseModel, table=True):
    __tablename__ = "saas_plans"  # type: ignore
    __table_args__ = (
        Index("ix_saas_plans_slug", "slug", unique=True),
    )

    name: str = Field(max_length=100)
    slug: str = Field(max_length=50)
    description: Optional[str] = Field(default=None, max_length=500)
    price_cents_monthly: int = Field(default=0, ge=0)
    price_cents_yearly: int = Field(default=0, ge=0)
    trial_days: int = Field(default=14)
    sort_order: int = Field(default=0)
    is_public: bool = Field(default=True)
    features: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )
    stripe_price_id_monthly: Optional[str] = Field(default=None, max_length=255)
    stripe_price_id_yearly: Optional[str] = Field(default=None, max_length=255)
