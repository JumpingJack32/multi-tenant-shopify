from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class TopProductResponse(BaseModel):
    product_id: UUID
    product_name: str
    primary_sku: Optional[str] = None
    units_sold: int
    total_revenue: int = Field(description="Revenue in pence")


class CategoryBreakdownResponse(BaseModel):
    category_id: str
    category_name: str
    units_sold: int
    total_revenue: int = Field(description="Revenue in pence")
    percentage_of_total: float


class MonthlyRetentionPoint(BaseModel):
    month: str
    new_customers: int
    returning_customers: int
    new_revenue: int
    returning_revenue: int


class CartAbandonmentPoint(BaseModel):
    month: str
    abandoned_carts: int
    completed_carts: int


class SalesReportRow(BaseModel):
    period: str
    gross_sales: int = Field(description="Revenue in pence")
    discounts: int
    net_sales: int
    tax: int
    shipping: int
    refunds: int
    order_count: int


class ProductReportRow(BaseModel):
    product_name: str
    sku: Optional[str] = None
    category: Optional[str] = None
    units_sold: int
    total_revenue: int = Field(description="Revenue in pence")
    avg_price: float
    times_ordered: int


class CustomerLTVRow(BaseModel):
    email: str
    first_order: Optional[str] = None
    last_order: Optional[str] = None
    order_count: int
    total_spent: int = Field(description="Revenue in pence")
    avg_order_value: float
    status: str = ""


class CartReportRow(BaseModel):
    period: str
    active_carts: int
    abandoned_carts: int
    completed_carts: int
    conversion_rate: float


class LiveViewResponse(BaseModel):
    active_carts: int
    today_revenue: int = Field(description="Revenue in pence")
    today_orders: int
    recent_activity: list[dict]


class CustomReportRequest(BaseModel):
    dimensions: list[str] = Field(default_factory=list)
    metrics: list[str]
    filters: dict = Field(default_factory=dict)
    group_by: list[str] = Field(default_factory=list)
    order_by: Optional[dict] = None
    limit: int = 50


class CustomReportResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
