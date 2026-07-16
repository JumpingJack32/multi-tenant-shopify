from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SAEnum, Index, JSON, Text, UniqueConstraint
from sqlmodel import Column, Field, Relationship

from src.orm.base import BaseModel


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    PAID = "paid"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class Order(BaseModel, table=True):
    __tablename__ = "orders" # type: ignore
    __table_args__ = (
        Index("ix_orders_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_orders_tenant_number", "tenant_id", "order_number"),
    )
    
    customer_id: Optional[UUID] = Field(default=None, foreign_key="customers.id", ondelete="SET NULL")
    # customer_id: UUID = Field(foreign_key="customers.id", ondelete="SET NULL")
    order_number: str = Field(max_length=50, unique=True)
    status: OrderStatus = Field(default=OrderStatus.PENDING, sa_column=Column(SAEnum(OrderStatus)))
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING, sa_column=Column(SAEnum(PaymentStatus)))
    payment_method: Optional[str] = Field(default=None, max_length=50)
    payment_intent_id: Optional[str] = Field(default=None, max_length=255)
    subtotal: int = Field(default=0, ge=0)
    tax: int = Field(default=0, ge=0)
    shipping: int = Field(default=0, ge=0)
    discount: int = Field(default=0, ge=0)
    total: int = Field(ge=0)
    currency: str = Field(default="USD", max_length=3)
    shipping_address: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict, comment="Shipping address JSON"),
    )
    billing_address: dict = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False, default=dict, comment="Billing address JSON"),
    )
    notes: Optional[str] = Field(default=None)
    options: Optional[dict] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=True, default=dict, comment="Order options JSON"),
    )

    items: list["OrderItem"] = Relationship(back_populates="order", cascade_delete=True)
    customer: Optional["Customer"] = Relationship(back_populates="orders")


class OrderItem(BaseModel, table=True):
    __tablename__ = "order_items" # type: ignore
    __table_args__ = (
        Index("ix_order_items_order", "order_id"),
    )

    order_id: UUID = Field(foreign_key="orders.id", ondelete="CASCADE")
    variant_id: Optional[UUID] = Field(default=None, foreign_key="variants.id", ondelete="SET NULL")
    product_id: Optional[UUID] = Field(default=None, foreign_key="products.id", ondelete="SET NULL")
    product_name: str = Field(max_length=255)
    variant_name: Optional[str] = Field(default=None, max_length=255)
    sku: str = Field(max_length=100)
    quantity: int = Field(ge=1)
    unit_price: int = Field(ge=0)
    total_price: int = Field(ge=0)
    discount: int = Field(default=0, ge=0)

    order: Order = Relationship(back_populates="items")


class Customer(BaseModel, table=True):
    __tablename__ = "customers" # type: ignore
    __table_args__ = (
        Index("ix_customers_tenant_email", "tenant_id", "email"),
        UniqueConstraint("tenant_id", "email", name="uq_customers_tenant_email"),
    )

    email: str = Field(max_length=255)
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    is_verified: bool = Field(default=False)
    total_orders: int = Field(default=0)
    total_spent: int = Field(default=0, ge=0)
    refunded_total: int = Field(default=0, ge=0)
    # last_order_at: Optional[datetime] = mapped_column(DateTime(timezone=True), default=None)
    last_order_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
    email_subscription_status: str = Field(default="subscribed", max_length=20)
    email_subscription_type: str = Field(default="digital", max_length=20)
    tags: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    notes: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    store_credit: int = Field(default=0, ge=0)
    last_synced_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True))
    )
    orders: list[Order] = Relationship(back_populates="customer")
    addresses: list["CustomerAddress"] = Relationship(back_populates="customer")
    credit_transactions: list["StoreCreditTransaction"] = Relationship(back_populates="customer")
    timeline_events: list["CustomerTimelineEvent"] = Relationship(back_populates="customer")


class CustomerAddress(BaseModel, table=True):
    __tablename__ = "customer_addresses" # type: ignore

    customer_id: UUID = Field(foreign_key="customers.id", ondelete="CASCADE")
    customer: "Customer" = Relationship(back_populates="addresses")
    address_type: str = Field(max_length=20)
    line1: str = Field(max_length=255)
    line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(max_length=100)
    province: Optional[str] = Field(default=None, max_length=100)
    postal_code: str = Field(max_length=20)
    country: str = Field(max_length=100)
    is_default: bool = Field(default=False)


class StoreCreditTransaction(BaseModel, table=True):
    __tablename__ = "store_credit_transactions" # type: ignore

    customer_id: UUID = Field(foreign_key="customers.id", ondelete="CASCADE")
    amount: int = Field()  # positive = credit, negative = debit (in pence)
    balance_after: int = Field()
    reason: str = Field(max_length=500)
    created_by: Optional[UUID] = Field(default=None)

    customer: Customer = Relationship(back_populates="credit_transactions")


class CustomerTimelineEvent(BaseModel, table=True):
    __tablename__ = "customer_timeline_events" # type: ignore

    customer_id: UUID = Field(foreign_key="customers.id", ondelete="CASCADE")
    event_type: str = Field(max_length=50)
    description: str = Field(max_length=1000)
    extra_data: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False, default=dict))
    created_by: Optional[UUID] = Field(default=None)

    customer: Customer = Relationship(back_populates="timeline_events")
