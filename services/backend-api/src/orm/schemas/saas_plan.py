from uuid import UUID

from pydantic import BaseModel


class SaaSPlanResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    price_cents_monthly: int
    price_cents_yearly: int
    trial_days: int
    sort_order: int
    is_public: bool
    features: list[str] = []
