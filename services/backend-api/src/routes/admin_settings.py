"""Admin settings endpoint — tenant settings JSON read/write."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.tenant import Tenant

router = APIRouter(tags=["admin-settings"])


@router.get("/admin/settings")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    tenant = (
        await db.exec(select(Tenant).where(Tenant.tenant_id == tenant_id))
    ).first()
    if not tenant:
        return {}
    return {
        "name": tenant.name,
        "slug": tenant.slug,
        "domain": tenant.domain or "",
        "settings": tenant.settings or {},
    }


@router.put("/admin/settings")
async def update_settings(
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    tenant = (
        await db.exec(select(Tenant).where(Tenant.tenant_id == tenant_id))
    ).first()
    if not tenant:
        return {"error": "Tenant not found"}

    if "name" in body:
        tenant.name = body["name"]
    if "domain" in body:
        tenant.domain = body["domain"]

    settings = dict(tenant.settings or {})
    settings.update(body.get("settings", {}))
    tenant.settings = settings

    db.add(tenant)
    await db.commit()
    return {"status": "ok"}
