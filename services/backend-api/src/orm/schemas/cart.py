from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CartItemResponse(BaseModel):
    id: UUID
    variant_id: UUID
    sku: str = ""
    product_name: str = ""
    variant_name: Optional[str] = None
    price: int = Field(ge=0, json_schema_extra={"is_price": True})
    quantity: int = Field(ge=1)
    image_url: Optional[str] = None


class CartResponse(BaseModel):
    id: UUID
    items: list[CartItemResponse] = []
    item_count: int = 0
    total: int = Field(ge=0, json_schema_extra={"is_price": True})
    created_at: datetime
    updated_at: datetime


class CartAddItemRequest(BaseModel):
    variant_id: UUID
    quantity: int = Field(default=1, ge=1)


class CartUpdateItemRequest(BaseModel):
    quantity: int = Field(ge=0)


class CheckoutRequest(BaseModel):
    currency: str = "USD"
    customer_email: str | None = None
    shipping_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
