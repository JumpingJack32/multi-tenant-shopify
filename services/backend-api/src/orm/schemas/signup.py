from uuid import UUID

from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-z0-9-]+$")
    plan_slug: str = Field(..., min_length=1)
    stripe_payment_method_id: str | None = None


class SignupResponse(BaseModel):
    tenant_id: UUID
    slug: str
    name: str
    admin_url: str
    trial_ends_at: str | None = None


class SlugCheckRequest(BaseModel):
    slug: str = Field(..., min_length=3, max_length=30, pattern=r"^[a-z0-9-]+$")


class SlugCheckResponse(BaseModel):
    available: bool
