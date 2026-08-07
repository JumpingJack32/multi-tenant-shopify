# services/backend-api/src/routes/webhooks.py
import base64
from datetime import datetime
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession
from svix.webhooks import Webhook as SvixWebhook, WebhookVerificationError

from src.config import settings
from src.dependencies import get_db
from src.orm.models.order import Customer

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ── Clerk Webhook (Svix-signed) ─────────────────────────────────────────


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    svix_signature: str = Header(None, alias="Svix-Signature"),
    svix_timestamp: str = Header(None, alias="Svix-Timestamp"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Clerk webhooks (Svix-signed) to sync invited -> active users.

    Listens for:
      - organizationInvitation.accepted : accept an org invite
      - user.created                    : a user signed up (public_metadata carries
                                          tenant_id + role)
    """
    from src.orm.models.tenant import Tenant, TenantUser

    body = await request.body()

    if not svix_signature or not svix_timestamp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Svix headers",
        )

    try:
        wh_secret = settings.clerk_webhook_secret
        if not wh_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Clerk webhook secret not configured",
            )
        wh = SvixWebhook(wh_secret)
        wh.verify(body, {
            "svix-signature": svix_signature,
            "svix-timestamp": svix_timestamp,
        })
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Svix signature",
        )

    try:
        event_data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_type = event_data.get("type", "")
    data = event_data.get("data", {}) or {}
    email = (data.get("email_address") or "").lower()
    public_metadata = data.get("public_metadata") or {}

    if event_type == "organizationInvitation.accepted":
        tenant_id = public_metadata.get("tenant_id")
        role = public_metadata.get("role", "member")
        if email and tenant_id:
            await _activate_tenant_user(db, tenant_id, email, role)
        return {"status": "received"}

    if event_type == "user.created":
        # public_metadata may carry tenant_id + role from the invitation link
        tenant_id = public_metadata.get("tenant_id")
        role = public_metadata.get("role")
        if email and tenant_id:
            await _activate_tenant_user(db, tenant_id, email, role)
        return {"status": "received"}

    return {"status": "received"}


async def _activate_tenant_user(
    db: AsyncSession,
    tenant_id: str,
    email: str,
    role: str | None,
) -> None:
    """Flip a pending invited TenantUser to active on invitation acceptance."""
    from uuid import UUID

    from src.orm.models.tenant import Tenant, TenantUser

    try:
        business_uuid = UUID(str(tenant_id))
    except ValueError:
        logger.warning("clerk webhook: invalid tenant_id %s", tenant_id)
        return

    tenant = (
        await db.exec(select(Tenant).where(Tenant.tenant_id == business_uuid))
    ).one_or_none()
    if not tenant:
        logger.warning("clerk webhook: tenant %s not found", tenant_id)
        return

    user = (
        await db.exec(
            select(TenantUser).where(
                TenantUser.tenant_id == tenant.id,
                TenantUser.email == email,
            )
        )
    ).one_or_none()

    if not user:
        # A user accepted without a prior invite record — create one
        user = TenantUser(
            tenant_id=tenant.id,
            clerk_user_id="",
            email=email,
            password_hash="",
            role=role or "member",
            status="active",
            is_active=True,
        )
        db.add(user)
    else:
        user.status = "active"
        user.is_active = True
        user.last_login_at = datetime.now()
        if role:
            user.role = role
        db.add(user)

    await db.commit()
    logger.info("clerk webhook: activated %s for tenant %s", email, tenant_id)


# ── Svix Webhook ─────────────────────────────────────────────────────────


@router.post("/svix")
async def svix_webhook(
    request: Request,
    svix_signature: str = Header(None, alias="Svix-Signature"),
    svix_timestamp: str = Header(None, alias="Svix-Timestamp"),
):
    """Handle Svix webhook relay with signature verification."""
    body = await request.body()

    if not svix_signature or not svix_timestamp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Svix headers",
        )

    if not settings.svix_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Svix webhooks not configured",
        )
    try:
        wh_secret = settings.svix_webhook_secret
        if not wh_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Svix webhook secret not configured",
            )
        wh = SvixWebhook(wh_secret)
        wh.verify(body, {
            "svix-signature": svix_signature,
            "svix-timestamp": svix_timestamp,
        })
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Svix signature",
        )

    try:
        event_data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_type = event_data.get("type", "")

    if event_type == "user.created":
        pass
    elif event_type == "order.created":
        pass

    return {"status": "received"}


# ── Shopify Webhook ──────────────────────────────────────────────────────


@router.post("/shopify")
async def shopify_webhook(
    request: Request,
    shop: str = Header(None, alias="X-Shopify-Shop-Domain"),
    hmac_header: str = Header(None, alias="X-Shopify-Hmac-Sha256"),
    topic: str = Header(None, alias="X-Shopify-Topic"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Shopify webhooks with HMAC verification."""
    body = await request.body()

    if not hmac_header or not shop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Shopify headers",
        )

    if not settings.shopify_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Shopify webhooks not configured",
        )

    expected_hmac = base64.b64encode(
        hmac.new(
            settings.shopify_webhook_secret.encode("utf-8"),
            body,
            hashlib.sha256,
        ).digest()
    ).decode()

    if not hmac.compare_digest(expected_hmac, hmac_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Shopify HMAC signature",
        )

    try:
        json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    if topic == "orders/create":
        pass
    elif topic == "orders/paid":
        pass

    return {"status": "received"}





