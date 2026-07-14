from datetime import date, datetime
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Text
from sqlmodel import Field, Relationship

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Location, Variant


class StockTransfer(BaseModel, table=True):
    __tablename__ = "stock_transfers"

    transfer_number: str = Field(max_length=50, nullable=False)
    origin_location_id: UUID = Field(foreign_key="locations.id", nullable=False)
    destination_location_id: UUID = Field(foreign_key="locations.id", nullable=False)
    status: str = Field(default="draft", max_length=50)
    estimated_arrival: Optional[date] = Field(default=None)
    carrier: Optional[str] = Field(default=None, max_length=100)
    tracking_number: Optional[str] = Field(default=None, max_length=255)
    reference_number: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = Field(default=None, sa_type=Text)
    sent_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    completed_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))
    cancelled_at: Optional[datetime] = Field(default=None, sa_type=DateTime(timezone=True))

    items: list["StockTransferItem"] = Relationship(back_populates="transfer", cascade_delete=True)


class StockTransferItem(BaseModel, table=True):
    __tablename__ = "stock_transfer_items"

    transfer_id: UUID = Field(foreign_key="stock_transfers.id", nullable=False)
    variant_id: UUID = Field(foreign_key="variants.id", nullable=False)
    quantity: int = Field(ge=1)
    received_quantity: Optional[int] = Field(default=None, ge=0)

    transfer: StockTransfer = Relationship(back_populates="items")
