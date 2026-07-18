from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.event import Event
from src.orm.models.webhook import WebhookSubscriber

router = APIRouter(tags=["admin"])


@router.post("/admin/webhooks", response_model=dict, status_code=201)
async def create_webhook(
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    sub = WebhookSubscriber(
        tenant_id=tenant_id,
        url=body["url"],
        secret=body.get("secret"),
        event_types=body.get("event_types", []),
    )
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return {"id": str(sub.id), "url": sub.url, "event_types": sub.event_types}


@router.get("/admin/webhooks", response_model=list[dict])
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(WebhookSubscriber).where(WebhookSubscriber.tenant_id == tenant_id)
    subs = (await db.exec(stmt)).all()
    return [
        {"id": str(s.id), "url": s.url, "event_types": s.event_types, "is_active": s.is_active}
        for s in subs
    ]


@router.put("/admin/webhooks/{webhook_id}", response_model=dict)
async def update_webhook(
    webhook_id: UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(WebhookSubscriber).where(WebhookSubscriber.id == webhook_id, WebhookSubscriber.tenant_id == tenant_id)
    sub = (await db.exec(stmt)).one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if "url" in body:
        sub.url = body["url"]
    if "secret" in body:
        sub.secret = body["secret"]
    if "event_types" in body:
        sub.event_types = body["event_types"]
    if "is_active" in body:
        sub.is_active = body["is_active"]
    db.add(sub)
    await db.flush()
    await db.refresh(sub)
    return {"id": str(sub.id), "url": sub.url, "event_types": sub.event_types, "is_active": sub.is_active}


@router.delete("/admin/webhooks/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: UUID,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(WebhookSubscriber).where(WebhookSubscriber.id == webhook_id, WebhookSubscriber.tenant_id == tenant_id)
    sub = (await db.exec(stmt)).one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await db.delete(sub)


@router.get("/admin/events", response_model=list[dict])
async def list_events(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = (
        select(Event)
        .where(Event.tenant_id == tenant_id)
        .order_by(Event.created_at.desc())
        .limit(50)
    )
    events = (await db.exec(stmt)).all()
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "source": e.source,
            "delivered": e.delivered,
            "retry_count": e.retry_count,
            "created_at": e.created_at.isoformat(),
        }
        for e in events
    ]
