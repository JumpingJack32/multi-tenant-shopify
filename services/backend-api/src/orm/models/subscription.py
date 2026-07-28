from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlmodel import Field

from src.orm.base import BaseModel


class SubscriptionPlan(BaseModel, table=True):
    __tablename__ = "subscription_plans"  # type: ignore

    product_id: UUID = Field(foreign_key="products.id", index=True)
    interval: str = Field(max_length=20)
    interval_count: int = Field(default=1)
    discount_percentage: int = Field(default=0)
    is_active: bool = Field(default=True)


class CustomerSubscription(BaseModel, table=True):
    __tablename__ = "customer_subscriptions"  # type: ignore

    customer_email: str = Field(max_length=320, index=True)
    subscription_plan_id: UUID = Field(foreign_key="subscription_plans.id")
    stripe_subscription_id: str = Field(max_length=255, index=True)
    status: str = Field(default="active", max_length=20)
    current_period_end: Optional[datetime] = Field(default=None)
    cancel_at_period_end: bool = Field(default=False)
