from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship

from src.orm.base import BaseModel


class POSequence(BaseModel, table=True):
    __tablename__ = "po_sequences"

    date_prefix: str = Field(max_length=8, nullable=False)  # YYYYMMDD
    counter: int = Field(default=0, ge=0)


class Supplier(BaseModel, table=True):
    __tablename__ = "suppliers"

    name: str = Field(max_length=255, nullable=False)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: str = Field(default="manual_email", max_length=50)


class PurchaseOrder(BaseModel, table=True):
    __tablename__ = "purchase_orders"

    po_number: str = Field(max_length=50, nullable=False)
    supplier_id: UUID = Field(foreign_key="suppliers.id", nullable=False, ondelete="RESTRICT")
    status: str = Field(default="pending_review", max_length=50)
    fulfillment_strategy: str = Field(default="dropship", max_length=50)
    ship_to_address_id: Optional[UUID] = Field(default=None, foreign_key="customer_addresses.id")
    ship_to_address_snapshot: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    tracking_number: Optional[str] = Field(default=None, max_length=255)
    carrier: Optional[str] = Field(default=None, max_length=100)
    subtotal: int = Field(default=0)
    tax: int = Field(default=0)
    shipping_cost: int = Field(default=0)
    total: int = Field(default=0)
    notes: Optional[str] = Field(default=None)
    sent_at: Optional[datetime] = Field(default=None)
    confirmed_at: Optional[datetime] = Field(default=None)
    closed_at: Optional[datetime] = Field(default=None)

    supplier: "Supplier" = Relationship()
    items: list["PurchaseOrderItem"] = Relationship(back_populates="purchase_order", cascade_delete=True)


class PurchaseOrderItem(BaseModel, table=True):
    __tablename__ = "purchase_order_items"

    purchase_order_id: UUID = Field(foreign_key="purchase_orders.id", nullable=False)
    variant_id: UUID = Field(foreign_key="variants.id", nullable=False)
    supplier_sku: Optional[str] = Field(default=None, max_length=255)
    product_name: str = Field(max_length=255)
    variant_label: str = Field(default="", max_length=255)
    quantity: int = Field(ge=1)
    unit_cost: int = Field(ge=0)
    subtotal: int = Field(default=0)
    received_quantity: Optional[int] = Field(default=None, ge=0)

    purchase_order: PurchaseOrder = Relationship(back_populates="items")


class OrderFulfillmentLink(BaseModel, table=True):
    __tablename__ = "order_fulfillment_links"

    order_item_id: UUID = Field(foreign_key="order_items.id", nullable=False, index=True)
    purchase_order_item_id: UUID = Field(foreign_key="purchase_order_items.id", nullable=False, index=True)
    quantity: int = Field(ge=1)
