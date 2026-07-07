from typing import TYPE_CHECKING, Optional

from sqlalchemy import Index, UniqueConstraint
from sqlmodel import Field, Relationship

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Product


class Category(BaseModel, table=True):
    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_categories_tenant_slug"),
        Index("ix_categories_tenant_active", "tenant_id", "is_active"),
    )

    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)

    products: list["Product"] = Relationship(back_populates="category")
