from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class OrderItemCreate(PydanticBaseModel):
    variant_id: Optional[UUID] = None
    product_id: Optional[UUID] = None
    product_name: str = ""
    sku: str = ""
    quantity: int = Field(..., ge=1)
    unit_price: int = Field(..., ge=0, json_schema_extra={"is_price": True})
    total_price: int = Field(default=0, ge=0, json_schema_extra={"is_price": True})
    discount: int = Field(default=0, ge=0, json_schema_extra={"is_price": True})


class OrderCreate(PydanticBaseModel):
    customer_id: Optional[UUID] = None
    order_number: Optional[str] = None
    status: Optional[str] = None
    items: list[OrderItemCreate]
    subtotal: int = Field(default=0, ge=0, json_schema_extra={"is_price": True})
    total: int = Field(default=0, ge=0, json_schema_extra={"is_price": True})
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
    subtotal: int = Field(json_schema_extra={"is_price": True})
    tax: int = Field(json_schema_extra={"is_price": True})
    shipping: int = Field(json_schema_extra={"is_price": True})
    discount: int = Field(json_schema_extra={"is_price": True})
    total: int = Field(json_schema_extra={"is_price": True})
    currency: str
    shipping_address: dict
    billing_address: dict
    notes: Optional[str] = None
    customer_email: Optional[str] = None
    options: Optional[dict] = None
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
    unit_price: int = Field(json_schema_extra={"is_price": True})
    total_price: int = Field(json_schema_extra={"is_price": True})
    discount: int = Field(json_schema_extra={"is_price": True})
    created_at: datetime
