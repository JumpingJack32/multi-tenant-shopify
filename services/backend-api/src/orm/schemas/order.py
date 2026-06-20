from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class OrderItemCreate(PydanticBaseModel):
    variant_id: UUID
    quantity: int = Field(..., ge=1)
    unit_price: float = Field(..., ge=0)
    discount: float = Field(default=0, ge=0)


class OrderCreate(PydanticBaseModel):
    customer_id: UUID
    items: list[OrderItemCreate]
    shipping_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    currency: str = "USD"


class OrderUpdate(PydanticBaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    shipping_address: Optional[dict] = None
    billing_address: Optional[dict] = None
    notes: Optional[str] = None


class OrderResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    customer_id: Optional[UUID] = None
    order_number: str
    status: str
    payment_status: str
    payment_method: Optional[str] = None
    payment_intent_id: Optional[str] = None
    subtotal: float
    tax: float
    shipping: float
    discount: float
    total: float
    currency: str
    shipping_address: dict
    billing_address: dict
    notes: Optional[str] = None
    metadata: dict
    items: list["OrderItemResponse"]
    created_at: datetime
    updated_at: datetime


class OrderItemResponse(PydanticBaseModel):
    id: UUID
    order_id: UUID
    variant_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    product_name: str
    variant_name: Optional[str] = None
    sku: str
    quantity: int
    unit_price: float
    total_price: float
    discount: float
    created_at: datetime
