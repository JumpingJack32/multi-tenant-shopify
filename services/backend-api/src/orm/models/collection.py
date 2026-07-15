from datetime import datetime, UTC
from typing import Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Index, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Product


class ProductCollection(SQLModel, table=True):
    __tablename__ = "product_collections"

    product_id: UUID = Field(foreign_key="products.id", primary_key=True)
    collection_id: UUID = Field(foreign_key="collections.id", primary_key=True)
    tenant_id: Optional[UUID] = Field(default=None, index=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        sa_type=DateTime(timezone=True),
        nullable=False,
    )


class Collection(BaseModel, table=True):
    __tablename__ = "collections"
    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_collections_tenant_slug"),
        Index("ix_collections_tenant_active", "tenant_id", "is_active"),
    )

    name: str = Field(max_length=255)
    slug: str = Field(max_length=255)
    description: Optional[str] = Field(default=None)
    hero_image_url: Optional[str] = Field(default=None, max_length=2048)
    hero_image_alt: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0)
    is_active: bool = Field(default=True)

    products: list["Product"] = Relationship(back_populates="collections", link_model=ProductCollection)
