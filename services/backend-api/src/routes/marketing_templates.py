import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from jinja2 import Environment
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_current_tenant_id, get_db
from src.orm.models.campaign import CampaignTemplate

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
        mailchimp_tag=body.get("mailchimp_tag"),
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
        "mailchimp_tag": tmpl.mailchimp_tag,
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
    if "mailchimp_tag" in body:
        tmpl.mailchimp_tag = body["mailchimp_tag"]
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
