"""Admin notification endpoints — aggregated operational alerts."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.services.notification_service import get_notifications

router = APIRouter(tags=["admin-notifications"])


@router.get("/admin/notifications")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    """Return aggregated operational alerts for the admin notification bell."""
    return await get_notifications(db, tenant_id)
