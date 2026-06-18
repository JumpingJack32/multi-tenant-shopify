from pydantic import BaseModel as PydanticBaseModel


class TenantCreate(PydanticBaseModel):
    tenant_id: str
    name: str
    slug: str


class TenantUpdate(PydanticBaseModel):
    name: str | None = None
    slug: str | None = None
    status: str | None = None


class TenantResponse(PydanticBaseModel):
    id: str
    tenant_id: str
    name: str
    slug: str
    status: str
    created_at: str
    updated_at: str
