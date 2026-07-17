from datetime import datetime, timezone
from enum import Enum
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlmodel import Field, Relationship

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.order import Order


class FulfillmentStatus(str, Enum):
    PENDING = "pending"
    TRANSIT = "transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    EXCEPTION = "exception"


class Fulfillment(BaseModel, table=True):
    __tablename__ = "fulfillments"  # type: ignore

    order_id: UUID = Field(foreign_key="orders.id", index=True)
    status: FulfillmentStatus = Field(default=FulfillmentStatus.PENDING)
    tracking_number: Optional[str] = Field(default=None, max_length=255)
    carrier: Optional[str] = Field(default=None, max_length=100)
    tracking_url: Optional[str] = Field(default=None, max_length=2048)
    shipped_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)

    items: list["FulfillmentItem"] = Relationship(back_populates="fulfillment", cascade_delete=True)
    order: Optional["Order"] = Relationship(back_populates="fulfillments")


class FulfillmentItem(BaseModel, table=True):
    __tablename__ = "fulfillment_items"  # type: ignore

    fulfillment_id: UUID = Field(foreign_key="fulfillments.id", index=True)
    order_item_id: UUID = Field(foreign_key="order_items.id")
    quantity: int = Field(ge=1)

    fulfillment: Fulfillment = Relationship(back_populates="items")
