from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class PromotionResponse(BaseModel):
    id: UUID
    code: str
    type: str
    value: int
    min_subtotal: Optional[int] = None
    max_uses: Optional[int] = None
    uses_count: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool

    model_config = {"from_attributes": True}


class PromotionCreate(BaseModel):
    code: str = Field(..., max_length=50)
    type: str = Field(...)
    value: int = Field(..., ge=0)
    min_subtotal: Optional[int] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, ge=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True


class PromotionUpdate(BaseModel):
    code: Optional[str] = None
    type: Optional[str] = None
    value: Optional[int] = Field(None, ge=0)
    min_subtotal: Optional[int] = Field(None, ge=0)
    max_uses: Optional[int] = Field(None, ge=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class ValidatePromotionRequest(BaseModel):
    code: str
    subtotal: int = Field(..., ge=0)


class ValidatePromotionResponse(BaseModel):
    valid: bool
    discount: int = 0
    type: Optional[str] = None
    value: Optional[int] = None
    message: str = ""
