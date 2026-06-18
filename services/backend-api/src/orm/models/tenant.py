from sqlmodel import Field
from src.orm.base import BaseModel


class Tenant(BaseModel, table=True):
    __tablename__ = "tenants"

    tenant_id: str = Field(unique=True)
    name: str
    slug: str = Field(unique=True)
    status: str = Field(default="active")
