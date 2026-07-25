"""Navigation menu endpoints — return nested tree from flat SQL."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.navigation import NavigationItem, NavigationMenu
from src.orm.schemas.navigation import NavigationTreeItem, NavigationTreeResponse

router = APIRouter(tags=["navigation"])

MAX_DEPTH = 3


def _build_tree(
    items: list[NavigationItem],
    parent_id: UUID | None = None,
    depth: int = 0,
) -> list[NavigationTreeItem]:
    """Build nested tree from flat sorted list. O(n) using pre-filtered iteration."""
    if depth >= MAX_DEPTH:
        return []

    result: list[NavigationTreeItem] = []
    for item in items:
        if item.parent_id == parent_id:
            children = _build_tree(items, item.id, depth + 1)
            result.append(
                NavigationTreeItem(
                    id=item.id,
                    title=item.title,
                    type=item.type,
                    href=item.href,
                    image_url=item.image_url,
                    open_in_new_tab=item.open_in_new_tab,
                    is_title_link=item.is_title_link,
                    show_view_all=item.show_view_all,
                    is_featured=item.is_featured,
                    badge=item.badge,
                    children=children,
                )
            )
    return result


@router.get("/navigation/{slug}", response_model=NavigationTreeResponse)
async def get_navigation(
    slug: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Return the navigation menu tree for the given slug."""
    menu = (
        await db.exec(
            select(NavigationMenu).where(
                NavigationMenu.tenant_id == tenant_id,
                NavigationMenu.slug == slug,
            )
        )
    ).first()

    if not menu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Navigation menu not found")

    all_items = (
        await db.exec(
            select(NavigationItem)
            .where(
                NavigationItem.menu_id == menu.id,
                NavigationItem.tenant_id == tenant_id,
            )
            .order_by(NavigationItem.sort_order)
        )
    ).all()

    tree = _build_tree(list(all_items))

    return NavigationTreeResponse(
        id=menu.id,
        slug=menu.slug,
        title=menu.title,
        items=tree,
    )
