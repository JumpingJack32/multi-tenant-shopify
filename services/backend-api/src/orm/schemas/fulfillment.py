from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FulfillmentItemCreate(BaseModel):
    order_item_id: UUID
    quantity: int = Field(ge=1)


class FulfillmentCreate(BaseModel):
    items_to_pack: list[FulfillmentItemCreate]
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    notify_customer: bool = False


class FulfillmentItemResponse(BaseModel):
    id: UUID
    order_item_id: UUID
    quantity: int

    model_config = {"from_attributes": True}


class FulfillmentResponse(BaseModel):
    id: UUID
    order_id: UUID
    status: str
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    tracking_url: Optional[str] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    items: list[FulfillmentItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TrackingUpdate(BaseModel):
    carrier: str
    tracking_number: str
    status: str
