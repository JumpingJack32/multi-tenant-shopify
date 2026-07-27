from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InventoryVariantResponse(BaseModel):
    id: UUID
    item_id: UUID  # aliased from product_id
    name: str
    sku: str
    barcode: Optional[str] = None
    price: int = Field(ge=0)
    cost: int = Field(ge=0)
    stock: int
    reorder_point: int = 0
    warehouse: str = "Default"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    sku: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    status: str  # computed: in_stock / low_stock / out_of_stock / discontinued
    supplier: Optional[str] = None
    total_stock: int
    total_value: int
    variants: list[InventoryVariantResponse]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryStatsResponse(BaseModel):
    total_skus: int
    total_value: int
    low_stock_count: int
    out_of_stock_count: int
    total_variants: int


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class InventoryListResponse(BaseModel):
    data: list[InventoryItemResponse]
    pagination: PaginationMeta


class InventoryItemCreateInput(BaseModel):
    name: str = Field(..., min_length=1)
    sku: str = Field(..., min_length=1)
    category: Optional[str] = None
    supplier: Optional[str] = None
    price: Optional[int] = Field(None, ge=0)
    stock: Optional[int] = Field(0, ge=0)


class InventoryItemPatchInput(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    supplier: Optional[str] = None
    price: Optional[int] = Field(None, ge=0)
    stock: Optional[int] = Field(None, ge=0)


class InventoryNodeResponse(BaseModel):
    id: UUID
    name: str
    type: str
    is_active: bool
    priority: int
    address: dict

    model_config = ConfigDict(from_attributes=True)


class InventoryNodeCreate(BaseModel):
    name: str
    type: str = "warehouse"
    is_active: bool = True
    priority: int = 0
    address: dict = {}


class InventoryNodeUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    address: Optional[dict] = None


class InventoryStockResponse(BaseModel):
    id: UUID
    variant_id: UUID
    node_id: UUID
    quantity: int
    reserved: int
    available: int

    model_config = ConfigDict(from_attributes=True)


class InventoryStockUpdate(BaseModel):
    variant_id: UUID
    node_id: UUID
    quantity: int


class InventoryTransferResponse(BaseModel):
    id: UUID
    from_node_id: UUID
    to_node_id: UUID
    variant_id: UUID
    quantity: int
    status: str
    reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class InventoryTransferCreate(BaseModel):
    from_node_id: UUID
    to_node_id: UUID
    variant_id: UUID
    quantity: int
    reason: Optional[str] = None
