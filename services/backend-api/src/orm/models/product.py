from enum import Enum
from typing import Any, Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Index, JSON, Text
from sqlmodel import Column, Field, Relationship

from src.orm.base import BaseModel
from src.orm.models.collection import ProductCollection

if TYPE_CHECKING:
    from src.orm.models.category import Category
    from src.orm.models.collection import Collection
    from src.orm.models.purchase_order import Supplier


class ProductStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class Product(BaseModel, table=True):
    __tablename__ = "products" # type: ignore
    __table_args__ = (
        Index("ix_products_tenant_slug", "tenant_id", "slug"),
    )

    name: str = Field(max_length=255)
    slug: str = Field(max_length=255, index=True)
    description: Optional[str] = Field(default=None, sa_type=Text)
    status: ProductStatus = Field(default=ProductStatus.DRAFT)
    sku: Optional[str] = Field(default=None, max_length=100, unique=True)
    weight: Optional[float] = Field(default=None)
    weight_unit: str = Field(default="kg", max_length=10)
    is_active: bool = Field(default=True)
    avg_rating: int = Field(default=0)
    review_count: int = Field(default=0)
    supplier_id: Optional[UUID] = Field(default=None, foreign_key="suppliers.id", nullable=True, ondelete="RESTRICT")
    specs: Optional[list[dict[str, str]]] = Field(
        default=None,
        sa_type=JSON,
        nullable=True,
    )

    # Relationships
    supplier_rel: Optional["Supplier"] = Relationship()
    variants: list["Variant"] = Relationship(back_populates="product", cascade_delete=True)
    images: list["ProductImage"] = Relationship(back_populates="product", cascade_delete=True)
    category_id: Optional[UUID] = Field(default=None, foreign_key="categories.id")
    category: Optional["Category"] = Relationship(back_populates="products")
    collections: list["Collection"] = Relationship(back_populates="products", link_model=ProductCollection)


class ProductImage(BaseModel, table=True):
    __tablename__ = "product_images" # type: ignore
    __table_args__ = (
        Index("ix_product_images_product", "product_id"),
    )

    product_id: UUID = Field(foreign_key="products.id", ondelete="CASCADE")
    url: str = Field(max_length=2048)
    alt_text: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0)

    # Relationships
    product: Product = Relationship(back_populates="images")


class Variant(BaseModel, table=True):
    __tablename__ = "variants" # type: ignore
    __table_args__ = (
        Index("ix_variants_tenant_sku", "tenant_id", "sku"),
    )

    product_id: UUID = Field(foreign_key="products.id", ondelete="CASCADE")
    sku: str = Field(max_length=100)
    barcode: Optional[str] = Field(default=None, max_length=255)
    price: int = Field(default=0, ge=0)
    compare_at_price: Optional[int] = Field(default=None, ge=0)
    weight: Optional[float] = Field(default=None)
    weight_unit: str = Field(default="kg", max_length=10)
    tax_code: Optional[str] = Field(default=None, max_length=50)
    inventory_quantity: int = Field(default=0)
    is_active: bool = Field(default=True)
    supplier_sku: Optional[str] = Field(default=None, max_length=255)
    cost_price: Optional[int] = Field(default=None, ge=0)
   # This is the correct pattern for JSON fields in SQLModel
    options: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(
            JSON,
            nullable=False,
            default=dict,
            comment="Variant options stored as JSON"
        )
    )

    # Relationships
    product: Product = Relationship(back_populates="variants")
    inventory: list["Inventory"] = Relationship(back_populates="variant", cascade_delete=True)


class Inventory(BaseModel, table=True):
    __tablename__ = "inventory" # type: ignore
    __table_args__ = (
        Index("ix_inventory_tenant_variant", "tenant_id", "variant_id"),
        Index("ix_inventory_tenant_location", "tenant_id", "location_id"),
    )
    variant_id: UUID = Field(foreign_key="variants.id", ondelete="CASCADE")
    # location_id: UUID = Field(foreign_key="locations.id", ondelete="SET NULL")
    location_id: Optional[UUID] = Field(default=None, foreign_key="locations.id", ondelete="SET NULL")
    quantity: int = Field(default=0, ge=0)
    reserved_quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0)
    reorder_quantity: int = Field(default=50)

    # Relationships
    variant: Variant = Relationship(back_populates="inventory")


class Location(BaseModel, table=True):
    __tablename__ = "locations" # type: ignore

    name: str = Field(max_length=255)
    address: Optional[str] = Field(default=None, sa_type=Text)
    city: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = Field(default=True)


