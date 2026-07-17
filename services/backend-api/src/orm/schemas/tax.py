from typing import Optional
from uuid import UUID

from pydantic import BaseModel as PydanticBaseModel, Field


class TaxConfigResponse(PydanticBaseModel):
    id: UUID
    tenant_id: UUID
    default_rate: int
    tax_inclusive: bool
    enabled: bool

    model_config = {"from_attributes": True}


class TaxConfigUpdate(PydanticBaseModel):
    default_rate: Optional[int] = Field(None, ge=0)
    tax_inclusive: Optional[bool] = None
    enabled: Optional[bool] = None
