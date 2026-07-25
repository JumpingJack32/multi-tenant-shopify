from decimal import Decimal
from typing import Optional

from sqlalchemy import Column, Numeric
from sqlmodel import Field

from src.orm.base import BaseModel


class ShippingMethod(BaseModel, table=True):
    __tablename__ = "shipping_methods"

    name: str = Field(max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    rate_type: str = Field(max_length=20)
    base_price: Decimal = Field(default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False, default=0))
    free_shipping_threshold: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2), nullable=True))
    min_weight: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2), nullable=True))
    max_weight: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 2), nullable=True))
    price_per_unit_weight: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(10, 4), nullable=True))
    is_active: bool = Field(default=True)
