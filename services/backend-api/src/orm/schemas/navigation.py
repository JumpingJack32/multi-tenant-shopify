from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class NavigationTreeItem(BaseModel):
    id: UUID
    title: str
    type: str
    href: Optional[str] = None
    image_url: Optional[str] = None
    open_in_new_tab: bool = False
    is_title_link: bool = False
    show_view_all: bool = False
    is_featured: bool = False
    badge: Optional[str] = None
    children: list["NavigationTreeItem"] = []


class NavigationTreeResponse(BaseModel):
    id: UUID
    slug: str
    title: str
    items: list[NavigationTreeItem]


class NavigationMenuSummary(BaseModel):
    id: UUID
    slug: str
    title: str


class NavigationItemPayload(BaseModel):
    id: Optional[UUID] = None
    parent_id: Optional[UUID] = None
    title: str
    type: str
    ref_id: Optional[UUID] = None
    href: Optional[str] = None
    sort_order: int = 0
    image_url: Optional[str] = None
    open_in_new_tab: bool = False
    is_title_link: bool = False
    show_view_all: bool = False
    is_featured: bool = False
    badge: Optional[str] = None
    children: list["NavigationItemPayload"] = []


class NavigationTreePayload(BaseModel):
    items: list[NavigationItemPayload]


class MenuCreateRequest(BaseModel):
    slug: str
    title: str


class MenuUpdateRequest(BaseModel):
    title: Optional[str] = None
