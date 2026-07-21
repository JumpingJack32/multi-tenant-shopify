from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field

from src.orm.schemas.customer import CustomerResponse  # noqa: F401

# ── Product ──────────────────────────────────────────────────────────────


class ProductCreate(PydanticBaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: str = "draft"
    sku: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str = "kg"
    specs: Optional[list[dict[str, str]]] = None
    is_active: bool = True
    images: list[str] = []


class ProductUpdate(PydanticBaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    sku: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    specs: Optional[list[dict[str, str]]] = None
    is_active: Optional[bool] = None


class ProductImageResponse(PydanticBaseModel):
    id: UUID
    url: str
    alt_text: Optional[str] = None
    sort_order: int


class ProductResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    status: str
    sku: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: str
    specs: Optional[list[dict[str, str]]] = None
    is_active: bool
    images: list[ProductImageResponse] = []
    created_at: datetime
    updated_at: datetime


class VariantCreate(PydanticBaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    barcode: Optional[str] = None
    price: int = Field(..., ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    weight: Optional[float] = None
    weight_unit: str = "kg"
    inventory_quantity: int = Field(default=0, ge=0)
    is_active: bool = True
    options: dict = Field(default_factory=dict)


class VariantUpdate(PydanticBaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    barcode: Optional[str] = None
    price: Optional[int] = Field(None, ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    inventory_quantity: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    options: Optional[dict] = None


class VariantResponse(PydanticBaseModel):
    id: UUID
    product_id: UUID
    sku: str
    barcode: Optional[str] = None
    price: int = Field(ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    weight: Optional[float] = None
    weight_unit: str
    inventory_quantity: int
    is_active: bool
    options: dict
    created_at: datetime
    updated_at: datetime


class ProductImageCreate(PydanticBaseModel):
    url: str = Field(..., min_length=1, max_length=2048)
    alt_text: Optional[str] = Field(None, max_length=500)
    sort_order: int = 0


class ProductImageUpdate(PydanticBaseModel):
    alt_text: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None


# ── Order ────────────────────────────────────────────────────────────────


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
    customer: Optional["CustomerResponse"] = None
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
