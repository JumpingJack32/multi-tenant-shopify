from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: UUID
    email: str
    role: str
    status: str
    is_active: bool
    is_platform_superuser: bool = False
    invited_at: datetime | None = None
    last_login_at: datetime | None = None


class InviteUserRequest(BaseModel):
    email: EmailStr
    role: str = Field(..., description="One of: owner, admin, ops_manager, support_agent, catalog_specialist, marketing_manager, finance")


class RoleUpdateRequest(BaseModel):
    role: str | None = None
    status: str | None = None
    is_active: bool | None = None


class TransferOwnershipRequest(BaseModel):
    pass


class PermissionCatalogResponse(BaseModel):
    permission_keys: list[str]
    role_permissions: dict[str, list[str]]
    my_permissions: list[str]
    my_role: str


class AuditLogResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    actor_email: str | None = None
    action: str
    resource_type: str | None = None
    resource_id: str | None = None
    details: dict = {}
    created_at: datetime
