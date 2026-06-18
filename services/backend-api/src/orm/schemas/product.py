from pydantic import BaseModel as PydanticBaseModel


class ProductCreate(PydanticBaseModel):
    name: str
    description: str | None = None
    price: int
    sku: str | None = None
    status: str = "draft"


class ProductUpdate(PydanticBaseModel):
    name: str | None = None
    description: str | None = None
    price: int | None = None
    sku: str | None = None
    status: str | None = None


class ProductResponse(PydanticBaseModel):
    id: str
    tenant_id: str
    name: str
    description: str | None
    price: int
    sku: str | None
    status: str
    created_at: str
    updated_at: str
