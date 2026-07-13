"""
Optional module docstring goes here.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime, timezone
# from sqlmodel import SQLModel, Field
# from sqlalchemy import Column, String, Boolean



class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------
# 1. Join Table — StoreUserLink must come before Tenant + User
# ---------------------------------------------------------------
class StoreUserLink(SQLModel, table=True):
    __tablename__ = "store_user_link"

    store_id: int = Field(foreign_key="tenant.id", primary_key=True, ondelete="CASCADE")
    user_id: str = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")
    role: UserRole = Field(default=UserRole.STAFF, index=True)

    # Direct FK relationships
    store: "Tenant" = Relationship(back_populates="users")
    user: "User" = Relationship(back_populates="stores")


# ---------------------------------------------------------------
# 2. Tenants
# ---------------------------------------------------------------
class TenantBase(SQLModel):
    slug: str = Field(unique=True, index=True)
    name: str


class Tenant(TenantBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=utcnow, nullable=False)

    users: List["User"] = Relationship(
        back_populates="tenant",
        sa_relationship_kwargs={"secondary": "store_user_link"},
    )
    products: List["Product"] = Relationship(back_populates="tenant")
    store_settings: Optional["StoreSettings"] = Relationship(back_populates="tenant")
    store_aliases: List["StoreAlias"] = Relationship(back_populates="tenant")


# ---------------------------------------------------------------
# 3. Users
# ---------------------------------------------------------------
class UserBase(SQLModel):
    email: str
    email_verified: Optional[bool] = Field(default=None)
    clerk_id: Optional[str] = Field(default=None)
    first_name: Optional[str] = Field(default=None)
    last_name: Optional[str] = Field(default=None)
    profile_image_url: Optional[str] = Field(default=None)



class User(UserBase, table=True):
    id: str = Field(primary_key=True)  # Clerk 'sub'
    tenant_id: Optional[int] = Field(default=None, foreign_key="tenant.id")
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)

    tenant: Optional["Tenant"] = Relationship(back_populates="users")


# ---------------------------------------------------------------
# 4. Store Settings
# ---------------------------------------------------------------
class StoreSettingsBase(SQLModel):
    theme_color: str = Field(default="#000000")
    accent_color: str = Field(default="#ffffff")
    logo_url: Optional[str] = Field(default=None)
    banner_url: Optional[str] = Field(default=None)
    custom_domain: Optional[str] = Field(default=None)
    seo_title: Optional[str] = Field(default=None)
    seo_description: Optional[str] = Field(default=None)


class StoreSettings(StoreSettingsBase, table=True):
    tenant_id: int = Field(primary_key=True, foreign_key="tenant.id")
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)

    tenant: "Tenant" = Relationship(back_populates="store_settings")


# ---------------------------------------------------------------
# 5. Products
# ---------------------------------------------------------------
class ProductBase(SQLModel):
    title: str
    description: Optional[str] = None
    price: int
    sku: str = Field(index=True)
    inventory_count: int = Field(default=0)
    tenant_id: int = Field(foreign_key="tenant.id")


class Product(ProductBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[str] = Field(default=None)

    tenant: "Tenant" = Relationship(back_populates="products")
    inventory: List["Inventory"] = Relationship(back_populates="product")


# ---------------------------------------------------------------
# 6. Inventory
# ---------------------------------------------------------------
class InventoryBase(SQLModel):
    quantity: int = Field(default=0)
    reserved_quantity: int = Field(default=0)


class Inventory(InventoryBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="product.id", ondelete="CASCADE")
    tenant_id: int = Field(foreign_key="tenant.id", ondelete="CASCADE")
    updated_at: Optional[str] = Field(default=None)

    product: "Product" = Relationship(back_populates="inventory")


# ---------------------------------------------------------------
# 7. Product Images
# ---------------------------------------------------------------
class ProductImageBase(SQLModel):
    url: str
    alt_text: Optional[str] = Field(default=None)
    sort_order: int = Field(default=0)


class ProductImage(ProductImageBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id", ondelete="CASCADE")
    product_id: int = Field()
    created_at: Optional[str] = Field(default=None)


# ---------------------------------------------------------------
# 8. Store Aliases
# ---------------------------------------------------------------
class StoreAliasBase(SQLModel):
    domain: str = Field(unique=True, index=True)
    www_domain: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    ssl_cert_url: Optional[str] = Field(default=None)


class StoreAlias(StoreAliasBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tenant_id: int = Field(foreign_key="tenant.id", ondelete="CASCADE")
    created_at: Optional[str] = Field(default=None)

    tenant: "Tenant" = Relationship(back_populates="store_aliases")


# ---------------------------------------------------------------
# DTOs
# ---------------------------------------------------------------
class TenantResponse(TenantBase):
    id: int


class TenantUpdate(SQLModel):
    name: Optional[str] = None
    slug: Optional[str] = None


class StoreSettingsResponse(SQLModel):
    tenant_id: int
    theme_color: str
    accent_color: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    custom_domain: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreSettingsCreate(SQLModel):
    theme_color: str = "#000000"
    accent_color: str = "#ffffff"
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    custom_domain: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


class StoreSettingsUpdate(SQLModel):
    theme_color: Optional[str] = None
    accent_color: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    custom_domain: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None


class StoreAliasResponse(SQLModel):
    id: int
    tenant_id: int
    domain: str
    www_domain: Optional[str] = None
    is_active: bool
    ssl_cert_url: Optional[str] = None
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreAliasCreate(SQLModel):
    domain: str
    www_domain: Optional[str] = None


class InventoryResponse(SQLModel):
    id: int
    product_id: int
    tenant_id: int
    quantity: int
    reserved_quantity: int
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class InventoryCreate(SQLModel):
    product_id: int
    quantity: int = 0
    reserved_quantity: int = 0


class InventoryUpdate(SQLModel):
    quantity: Optional[int] = None
    reserved_quantity: Optional[int] = None


class ProductImageResponse(SQLModel):
    id: int
    tenant_id: int
    product_id: int
    url: str
    alt_text: Optional[str] = None
    sort_order: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductImageCreate(SQLModel):
    product_id: int
    url: str
    alt_text: Optional[str] = None
    sort_order: int = 0


class ProductImageUpdate(SQLModel):
    url: Optional[str] = None
    alt_text: Optional[str] = None
    sort_order: Optional[int] = None


class ProductResponse(SQLModel):
    id: int
    title: str
    description: Optional[str] = None
    price: int
    sku: str
    inventory_count: int
    tenant_id: int
    store_id: int
    created_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ProductUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[int] = None
    sku: Optional[str] = None
    inventory_count: Optional[int] = None
    store_id: Optional[int] = None


class UserResponse(UserBase):
    id: str


class UserLinkCreate(SQLModel):
    user_id: str = Field(description="Clerk user ID (e.g., user_xxx)")
    role: UserRole


class UserLinkUpdate(SQLModel):
    role: UserRole


class UserLinkResponse(SQLModel):
    store_id: int
    user_id: str
    role: UserRole
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class StoreMemberResponse(SQLModel):
    user: UserResponse
    link: UserLinkResponse

    model_config = {"from_attributes": True}
