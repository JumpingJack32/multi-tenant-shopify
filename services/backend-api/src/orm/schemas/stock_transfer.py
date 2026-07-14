from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TransferItemCreate(BaseModel):
    variant_id: UUID
    quantity: int = Field(ge=1)


class TransferCreateInput(BaseModel):
    origin_location_id: UUID
    destination_location_id: UUID
    estimated_arrival: Optional[date] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    items: list[TransferItemCreate] = Field(default_factory=list)


class TransferPatchInput(BaseModel):
    status: Optional[str] = None
    estimated_arrival: Optional[date] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class TransferItemResponse(BaseModel):
    id: UUID
    variant_id: UUID
    quantity: int
    received_quantity: Optional[int] = None
    sku: str = ""
    product_name: str = ""

    model_config = ConfigDict(from_attributes=True)


class TransferResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    transfer_number: str
    origin_location_id: UUID
    destination_location_id: UUID
    origin_location_name: str = ""
    destination_location_name: str = ""
    status: str
    estimated_arrival: Optional[date] = None
    carrier: Optional[str] = None
    tracking_number: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    items: list[TransferItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class TransferListResponse(BaseModel):
    data: list[TransferResponse]
    pagination: PaginationMeta
