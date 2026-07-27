from typing import Optional
from uuid import UUID

from sqlalchemy import Index
from sqlmodel import Field

from src.orm.base import BaseModel


class ProductReview(BaseModel, table=True):
    __tablename__ = "product_reviews"  # type: ignore
    __table_args__ = (
        Index("ix_reviews_product_status", "product_id", "status"),
    )

    product_id: UUID = Field(foreign_key="products.id", index=True)
    customer_id: Optional[UUID] = Field(default=None, foreign_key="customers.id")
    rating: int = Field(ge=1, le=5)
    title: str = Field(max_length=150)
    body: str = Field(max_length=5000)
    reviewer_name: str = Field(max_length=100)
    is_verified_buyer: bool = Field(default=False)
    status: str = Field(default="PENDING", max_length=20)
    helpful_count: int = Field(default=0)
