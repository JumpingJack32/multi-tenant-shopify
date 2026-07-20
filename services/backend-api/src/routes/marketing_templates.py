from datetime import datetime, timezone
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jinja2 import Environment
from sqlmodel import select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.campaign import CampaignTemplate
from src.orm.models.dispatch import CampaignDispatch, CampaignDispatchRecipient, DispatchStatus
from src.orm.models.order import Customer
from src.orm.models.segment import SavedSegment
from src.orm.schemas.dispatch import DispatchCreate, DispatchResponse
from src.services.segment_service import get_customer_ids_for_filters

router = APIRouter(tags=["marketing"])


def sanitize_tokens(html: str) -> str:
    """Strip formatting tags and entities inside Jinja2 tokens."""
    def _clean(match):
        inner = match.group(1)
        inner = re.sub(r'</?(?:span|strong|em|b|i|u|font|style|p|br)[^>]*>', '', inner)
        inner = re.sub(r'&nbsp;', ' ', inner)
        return "{{ " + inner.strip() + " }}"
    return re.sub(r'\{\{([\s\S]*?)\}\}', _clean, html)


def validate_jinja2(template: str):
    """Raise 400 if template has syntax errors."""
    env = Environment()
    try:
        env.parse(template)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template syntax error: {e}")


@router.get("/marketing/templates", response_model=list[dict])
async def list_templates(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignTemplate).where(CampaignTemplate.tenant_id == tenant_id).order_by(CampaignTemplate.name)
    templates = (await db.exec(stmt)).all()
    return [
        {
            "id": str(t.id),
            "name": t.name,
            "subject": t.subject,
            "is_active": t.is_active,
            "send_at": t.send_at.isoformat() if t.send_at else None,
            "created_at": t.created_at.isoformat(),
        }
        for t in templates
    ]


@router.post("/marketing/templates", response_model=dict, status_code=201)
async def create_template(
    body: dict,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    html = sanitize_tokens(body.get("body_html", ""))
    validate_jinja2(html)

    tmpl = CampaignTemplate(
        tenant_id=tenant_id,
        name=body["name"],
        subject=body.get("subject", ""),
        body_html=html,
        body_json=body.get("body_json"),
    )
    db.add(tmpl)
    await db.flush()
    await db.refresh(tmpl)
    return {"id": str(tmpl.id), "name": tmpl.name, "subject": tmpl.subject}


@router.get("/marketing/templates/{template_id}", response_model=dict)
async def get_template(
    template_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignTemplate).where(CampaignTemplate.id == template_id, CampaignTemplate.tenant_id == tenant_id)
    tmpl = (await db.exec(stmt)).one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": str(tmpl.id),
        "name": tmpl.name,
        "subject": tmpl.subject,
        "body_html": tmpl.body_html,
        "body_json": tmpl.body_json,
        "is_active": tmpl.is_active,
        "send_at": tmpl.send_at.isoformat() if tmpl.send_at else None,
        "send_recurrence": tmpl.send_recurrence,
        "last_sent_at": tmpl.last_sent_at.isoformat() if tmpl.last_sent_at else None,
    }


@router.put("/marketing/templates/{template_id}", response_model=dict)
async def update_template(
    template_id: UUID,
    body: dict,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignTemplate).where(CampaignTemplate.id == template_id, CampaignTemplate.tenant_id == tenant_id)
    tmpl = (await db.exec(stmt)).one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    if "body_html" in body:
        html = sanitize_tokens(body["body_html"])
        validate_jinja2(html)
        tmpl.body_html = html
    if "name" in body:
        tmpl.name = body["name"]
    if "subject" in body:
        tmpl.subject = body["subject"]
    if "body_json" in body:
        tmpl.body_json = body["body_json"]
    if "is_active" in body:
        tmpl.is_active = body["is_active"]
    if "send_at" in body:
        tmpl.send_at = body["send_at"]
    if "send_recurrence" in body:
        tmpl.send_recurrence = body["send_recurrence"]

    db.add(tmpl)
    await db.flush()
    await db.refresh(tmpl)
    return {"id": str(tmpl.id), "name": tmpl.name, "subject": tmpl.subject}


@router.delete("/marketing/templates/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignTemplate).where(CampaignTemplate.id == template_id, CampaignTemplate.tenant_id == tenant_id)
    tmpl = (await db.exec(stmt)).one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tmpl)


# ── Campaign Dispatches ──────────────────────────────────────────────


@router.get("/marketing/dispatches", response_model=list[DispatchResponse])
async def list_dispatches(
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    stmt = select(CampaignDispatch).where(CampaignDispatch.tenant_id == tenant_id)
    if status_filter:
        stmt = stmt.where(CampaignDispatch.status == status_filter)
    stmt = stmt.order_by(CampaignDispatch.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    return (await db.exec(stmt)).all()


@router.post("/marketing/dispatches", response_model=DispatchResponse, status_code=status.HTTP_201_CREATED)
async def create_dispatch(
    body: DispatchCreate,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    template = await db.get(CampaignTemplate, body.template_id)
    if not template or template.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Template not found")

    segment_stmt = select(SavedSegment).where(SavedSegment.id == body.segment_id, SavedSegment.tenant_id == tenant_id)
    segment = (await db.exec(segment_stmt)).one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    target_schedule = body.scheduled_at or (datetime.now(timezone.utc) if body.send_immediately else None)
    target_status = DispatchStatus.SCHEDULED if target_schedule else DispatchStatus.DRAFT

    customer_ids = await get_customer_ids_for_filters(db, tenant_id, segment.filters)
    subscribed_ids = set()
    if customer_ids:
        c_stmt = select(Customer).where(Customer.id.in_(customer_ids), Customer.email_subscription_status == "subscribed")  # type: ignore[arg-type]
        for c in (await db.exec(c_stmt)).all():
            subscribed_ids.add(c.id)

    dispatch = CampaignDispatch(
        tenant_id=tenant_id,
        name=body.name,
        template_id=body.template_id,
        segment_id=body.segment_id,
        template_html=template.body_html,
        status=target_status,
        scheduled_at=target_schedule,
        total_count=len(subscribed_ids),
    )
    db.add(dispatch)
    await db.flush()

    # Bulk insert recipient rows
    if subscribed_ids:
        await db.execute(
            text("""
                INSERT INTO campaign_dispatch_recipients (id, dispatch_id, customer_id, email, status)
                SELECT gen_random_uuid(), :dispatch_id, c.id, c.email, 'pending'
                FROM customers c
                WHERE c.id = ANY(:ids) AND c.email_subscription_status = 'subscribed'
            """),
            {"dispatch_id": dispatch.id, "ids": list(subscribed_ids)},
        )

    await db.commit()
    await db.refresh(dispatch)
    return dispatch


@router.get("/marketing/dispatches/{dispatch_id}", response_model=DispatchResponse)
async def get_dispatch(
    dispatch_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignDispatch).where(CampaignDispatch.id == dispatch_id, CampaignDispatch.tenant_id == tenant_id)
    dispatch = (await db.exec(stmt)).one_or_none()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch


@router.post("/marketing/dispatches/{dispatch_id}/schedule", response_model=DispatchResponse)
async def schedule_dispatch(
    dispatch_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
    scheduled_at: datetime = Query(...),
):
    stmt = select(CampaignDispatch).where(CampaignDispatch.id == dispatch_id, CampaignDispatch.tenant_id == tenant_id)
    dispatch = (await db.exec(stmt)).one_or_none()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    dispatch.scheduled_at = scheduled_at
    dispatch.status = DispatchStatus.SCHEDULED
    db.add(dispatch)
    await db.commit()
    await db.refresh(dispatch)
    return dispatch


@router.post("/marketing/dispatches/{dispatch_id}/cancel", response_model=DispatchResponse)
async def cancel_dispatch(
    dispatch_id: UUID,
    db=Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id),
):
    stmt = select(CampaignDispatch).where(CampaignDispatch.id == dispatch_id, CampaignDispatch.tenant_id == tenant_id)
    dispatch = (await db.exec(stmt)).one_or_none()
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    dispatch.status = DispatchStatus.DRAFT
    dispatch.scheduled_at = None
    db.add(dispatch)
    await db.commit()
    await db.refresh(dispatch)
    return dispatch
