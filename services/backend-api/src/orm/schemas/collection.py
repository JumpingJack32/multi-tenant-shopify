from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class CollectionCreate(PydanticBaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    hero_image_url: Optional[str] = Field(None, max_length=2048)
    hero_image_alt: Optional[str] = Field(None, max_length=500)
    sort_order: int = 0
    is_active: bool = True

    model_config = {"from_attributes": True}


class CollectionUpdate(PydanticBaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    hero_image_url: Optional[str] = Field(None, max_length=2048)
    hero_image_alt: Optional[str] = Field(None, max_length=500)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

    model_config = {"from_attributes": True}


class CollectionResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    hero_image_url: Optional[str] = None
    hero_image_alt: Optional[str] = None
    sort_order: int
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
