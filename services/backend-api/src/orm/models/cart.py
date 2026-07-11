from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Column, DateTime
from sqlmodel import Field, Relationship

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Variant


class Cart(BaseModel, table=True):
    __tablename__ = "carts"

    customer_id: Optional[UUID] = Field(default=None, foreign_key="customers.id", ondelete="SET NULL")
    expires_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

    items: list["CartItem"] = Relationship(back_populates="cart", cascade_delete=True)


class CartItem(BaseModel, table=True):
    __tablename__ = "cart_items"

    cart_id: UUID = Field(foreign_key="carts.id", ondelete="CASCADE")
    variant_id: UUID = Field(foreign_key="variants.id", ondelete="CASCADE")
    quantity: int = Field(ge=1)

    cart: "Cart" = Relationship(back_populates="items")
    variant: Optional["Variant"] = Relationship()
