from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TenantCreate(BaseModel):
    name: str
    slug: str


class TenantUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    status: str | None = None


class TenantResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    status: str
    created_at: datetime
    updated_at: datetime


class TenantUserAuthCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    tenant_slug: str


class TenantUserAuthResponse(BaseModel):
    user_id: UUID
    email: str
    tenant_id: UUID
    role: str


class TenantUserAuthLogin(BaseModel):
    email: EmailStr
    password: str


class TenantTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
