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
