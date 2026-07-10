from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupplierResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    delivery_method: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupplierCreateInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: str = Field(default="manual_email")


class SupplierPatchInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: Optional[str] = Field(default=None)


class PurchaseOrderItemResponse(BaseModel):
    id: UUID
    variant_id: UUID
    supplier_sku: Optional[str] = None
    product_name: str
    variant_label: str
    quantity: int
    unit_cost: int
    subtotal: int
    received_quantity: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class AddressSnapshot(BaseModel):
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    po_number: str
    supplier_id: UUID
    supplier_name: str
    status: str
    fulfillment_strategy: str
    ship_to_address: Optional[AddressSnapshot] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    subtotal: int
    tax: int
    shipping_cost: int
    total: int
    source_order_number: Optional[str] = None
    items: list[PurchaseOrderItemResponse]
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PurchaseOrderListResponse(BaseModel):
    data: list[PurchaseOrderResponse]
    pagination: PaginationMeta


class SupplierListResponse(BaseModel):
    data: list[SupplierResponse]
    pagination: PaginationMeta


class PurchaseOrderPatchInput(BaseModel):
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    notes: Optional[str] = None


class PendingPOStats(BaseModel):
    pending_po_count: int = 0
    pending_po_total: int = 0
