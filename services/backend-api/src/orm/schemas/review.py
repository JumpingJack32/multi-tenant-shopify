from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProductReviewResponse(BaseModel):
    id: UUID
    product_id: UUID
    rating: int
    title: str
    body: str
    reviewer_name: str
    is_verified_buyer: bool
    status: str
    helpful_count: int
    created_at: str

    model_config = {"from_attributes": True}


class ProductReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., max_length=150)
    body: str = Field(..., max_length=5000)
    reviewer_name: str = Field(..., max_length=100)
    customer_email: Optional[str] = None
