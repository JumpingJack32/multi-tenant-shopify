from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class FulfillmentCounts(BaseModel):
    unfulfilled: int = 0
    processing: int = 0
    shipped: int = 0
    delivered: int = 0


class LowStockItem(BaseModel):
    variant_id: UUID
    product_name: str
    sku: str
    quantity: int
    threshold: int = 5


class RecentOrderItem(BaseModel):
    id: UUID
    order_number: str
    customer_name: Optional[str] = None
    total: int
    status: str
    created_at: str


class DashboardSummaryResponse(BaseModel):
    revenue_mtd: int = 0
    revenue_total: int = 0
    revenue_prev_mtd: int = 0
    orders_mtd: int = 0
    orders_total: int = 0
    orders_prev_mtd: int = 0
    aov: int = 0
    active_customers: int = 0
    active_customers_prev: int = 0
    fulfillment: FulfillmentCounts = FulfillmentCounts()
    low_stock: list[LowStockItem] = []
    recent_orders: list[RecentOrderItem] = []
