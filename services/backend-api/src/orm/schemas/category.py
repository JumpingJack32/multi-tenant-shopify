from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=255)
    slug: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
