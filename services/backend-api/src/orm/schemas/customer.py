from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class CustomerCreate(PydanticBaseModel):
    email: str = Field(..., max_length=255)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)


class CustomerUpdate(PydanticBaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    is_verified: Optional[bool] = None


class CustomerResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_verified: bool
    total_orders: int
    total_spent: int
    last_order_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CustomerAddressResponse(PydanticBaseModel):
    id: UUID
    address_type: str
    line1: str
    line2: Optional[str] = None
    city: str
    province: Optional[str] = None
    postal_code: str
    country: str
    is_default: bool

    model_config = {"from_attributes": True}


class CustomerOrderResponse(PydanticBaseModel):
    id: UUID
    order_number: str
    total: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerDetailResponse(CustomerResponse):
    average_order_value: int = 0
    addresses: list[CustomerAddressResponse] = []
    orders: list[CustomerOrderResponse] = []
