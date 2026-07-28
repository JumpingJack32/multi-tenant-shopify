from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class SubscriptionPlanResponse(BaseModel):
    id: UUID
    product_id: UUID
    interval: str
    interval_count: int
    discount_percentage: int
    is_active: bool

    model_config = {"from_attributes": True}


class CustomerSubscriptionResponse(BaseModel):
    id: UUID
    customer_email: str
    subscription_plan_id: UUID
    stripe_subscription_id: str
    status: str
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
