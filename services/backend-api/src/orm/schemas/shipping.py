from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ShippingMethodResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    rate_type: str
    base_price: Decimal
    free_shipping_threshold: Optional[Decimal] = None
    is_active: bool

    model_config = {"from_attributes": True}


class CreateShippingMethodRequest(BaseModel):
    name: str
    description: Optional[str] = None
    rate_type: str
    base_price: Decimal
    free_shipping_threshold: Optional[Decimal] = None
    is_active: bool = True


class UpdateShippingMethodRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rate_type: Optional[str] = None
    base_price: Optional[Decimal] = None
    free_shipping_threshold: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ShippingRateResult(BaseModel):
    method_id: UUID
    name: str
    cost: Decimal
    is_free: bool
