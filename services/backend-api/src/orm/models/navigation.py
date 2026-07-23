from typing import Optional
from uuid import UUID

from sqlalchemy import Index
from sqlmodel import Column, Field, Relationship

from src.orm.base import BaseModel


class NavigationMenu(BaseModel, table=True):
    __tablename__ = "navigation_menus"

    tenant_id: UUID = Field(index=True, nullable=False)
    slug: str = Field(max_length=100)
    title: str = Field(max_length=200)

    items: list["NavigationItem"] = Relationship(back_populates="menu", cascade_delete=True)


class NavigationItem(BaseModel, table=True):
    __tablename__ = "navigation_items"
    __table_args__ = (
        Index("ix_nav_menu_parent_sort", "menu_id", "parent_id", "sort_order"),
    )

    tenant_id: UUID = Field(index=True, nullable=False)
    menu_id: UUID = Field(foreign_key="navigation_menus.id", index=True, nullable=False)
    parent_id: Optional[UUID] = Field(default=None, foreign_key="navigation_items.id", index=True)

    title: str = Field(max_length=200)
    type: str = Field(max_length=50)
    ref_id: Optional[UUID] = Field(default=None)
    href: Optional[str] = Field(default=None, max_length=500)
    sort_order: int = Field(default=0)

    image_url: Optional[str] = Field(default=None, max_length=500)
    open_in_new_tab: bool = Field(default=False)
    is_title_link: bool = Field(default=False)
    show_view_all: bool = Field(default=False)
    is_featured: bool = Field(default=False)
    badge: Optional[str] = Field(default=None, max_length=100)

    menu: NavigationMenu = Relationship(back_populates="items")
    parent: Optional["NavigationItem"] = Relationship(
        back_populates="children",
        sa_relationship_kwargs={"remote_side": "NavigationItem.id"},
    )
    children: list["NavigationItem"] = Relationship(back_populates="parent", cascade_delete=True)
