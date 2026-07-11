from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class StorefrontVariantResponse(BaseModel):
    id: UUID
    sku: str
    price: int = Field(ge=0)
    compare_at_price: Optional[int] = Field(None, ge=0)
    is_active: bool
    in_stock: bool
    options: dict


class StorefrontProductResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    status: str
    min_price: int = Field(ge=0)
    max_price: int = Field(ge=0)
    images: list["StorefrontImageResponse"] = []
    variants: list[StorefrontVariantResponse] = []
    category_slug: Optional[str] = None
    collection_slugs: list[str] = []
    created_at: datetime
    updated_at: datetime


class StorefrontImageResponse(BaseModel):
    id: UUID
    url: str
    alt_text: Optional[str] = None
    sort_order: int
