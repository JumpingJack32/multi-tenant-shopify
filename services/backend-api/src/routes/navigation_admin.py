"""Admin navigation endpoints — CRUD + tree reconciliation."""

import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import delete

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.navigation import NavigationItem, NavigationMenu
from src.orm.schemas.navigation import (
    MenuCreateRequest,
    MenuUpdateRequest,
    NavigationItemPayload,
    NavigationMenuSummary,
    NavigationTreePayload,
    NavigationTreeResponse,
)
from src.routes.navigation import _build_tree

router = APIRouter(tags=["admin-navigation"])

REVALIDATION_SECRET = os.environ.get("REVALIDATION_SECRET", "")
STOREFRONT_URL = os.environ.get("STOREFRONT_URL", "http://localhost:3000")


def _revalidate_storefront_cache(tenant_slug: str, tag_type: str) -> None:
    """Fire-and-forget revalidation request to the storefront."""
    if not REVALIDATION_SECRET or not STOREFRONT_URL:
        return
    tag = f"{tag_type}-{tenant_slug}"
    import asyncio

    async def _fire():
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(
                    f"{STOREFRONT_URL}/api/revalidate",
                    json={"secret": REVALIDATION_SECRET, "tag": tag},
                )
        except Exception:
            pass

    asyncio.create_task(_fire())

MAX_DEPTH = 3


def _flatten_payload(items: list[NavigationItemPayload], parent_id: UUID | None = None, depth: int = 0) -> list[dict]:
    """Flatten tree payload into a list with parent_id and depth tracking."""
    if depth > MAX_DEPTH:
        raise HTTPException(status_code=400, detail=f"Max nesting depth is {MAX_DEPTH}")
    result = []
    for i, item in enumerate(items):
        children = item.children or []
        row = item.model_dump(exclude={"children"})
        row["parent_id"] = parent_id
        row["sort_order"] = i
        result.append(row)
        result.extend(_flatten_payload(children, item.id, depth + 1))
    return result


@router.get("/admin/navigation", response_model=list[NavigationMenuSummary])
async def list_menus(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    result = await db.exec(
        select(NavigationMenu).where(NavigationMenu.tenant_id == tenant_id)
    )
    return [
        NavigationMenuSummary(id=m.id, slug=m.slug, title=m.title)
        for m in result
    ]


@router.post("/admin/navigation", response_model=NavigationMenuSummary, status_code=201)
async def create_menu(
    body: MenuCreateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    existing = (
        await db.exec(
            select(NavigationMenu).where(
                NavigationMenu.tenant_id == tenant_id,
                NavigationMenu.slug == body.slug,
            )
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Menu with this slug already exists")
    menu = NavigationMenu(tenant_id=tenant_id, slug=body.slug, title=body.title)
    db.add(menu)
    await db.commit()
    await db.refresh(menu)
    return NavigationMenuSummary(id=menu.id, slug=menu.slug, title=menu.title)


@router.get("/admin/navigation/{menu_id}", response_model=NavigationTreeResponse)
async def get_menu_tree(
    menu_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    menu = (
        await db.exec(
            select(NavigationMenu).where(
                NavigationMenu.id == menu_id,
                NavigationMenu.tenant_id == tenant_id,
            )
        )
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    all_items = (
        await db.exec(
            select(NavigationItem)
            .where(
                NavigationItem.menu_id == menu_id,
                NavigationItem.tenant_id == tenant_id,
            )
            .order_by(NavigationItem.sort_order)
        )
    ).all()

    tree = _build_tree(list(all_items))
    return NavigationTreeResponse(id=menu.id, slug=menu.slug, title=menu.title, items=tree)


@router.put("/admin/navigation/{menu_id}")
async def update_menu(
    menu_id: UUID,
    body: MenuUpdateRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    menu = (
        await db.exec(
            select(NavigationMenu).where(
                NavigationMenu.id == menu_id,
                NavigationMenu.tenant_id == tenant_id,
            )
        )
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    if body.title is not None:
        menu.title = body.title
    db.add(menu)
    await db.commit()
    return {"status": "ok"}


@router.put("/admin/navigation/{menu_id}/items")
async def reconcile_tree(
    menu_id: UUID,
    payload: NavigationTreePayload,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    # Verify menu belongs to tenant
    menu = (
        await db.exec(
            select(NavigationMenu).where(
                NavigationMenu.id == menu_id,
                NavigationMenu.tenant_id == tenant_id,
            )
        )
    ).first()
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")

    # Phase 1: flatten incoming payload
    try:
        flat_incoming = _flatten_payload(payload.items)
    except HTTPException:
        raise

    incoming_ids = {r["id"] for r in flat_incoming if r.get("id")}

    # Phase 2: fetch existing items
    existing = (
        await db.exec(
            select(NavigationItem).where(
                NavigationItem.menu_id == menu_id,
                NavigationItem.tenant_id == tenant_id,
            )
        )
    ).all()
    existing_map = {item.id: item for item in existing}

    # Phase 3: delete removed items
    for item in existing:
        if item.id not in incoming_ids:
            await db.delete(item)
    await db.flush()

    # Phase 4: upsert
    for row in flat_incoming:
        row_id = row.get("id")
        if row_id and row_id in existing_map:
            db_item = existing_map[row_id]
            for key, val in row.items():
                if key != "id":
                    setattr(db_item, key, val)
            db.add(db_item)
        else:
            new_item = NavigationItem(
                tenant_id=tenant_id,
                menu_id=menu_id,
                **{k: v for k, v in row.items() if k != "id"},
            )
            db.add(new_item)

    await db.commit()

    from src.orm.models.tenant import Tenant
    tenant_obj = (await db.exec(select(Tenant).where(Tenant.tenant_id == tenant_id))).first()
    if tenant_obj:
        _revalidate_storefront_cache(tenant_obj.slug, "navigation")

    return {"status": "ok"}
