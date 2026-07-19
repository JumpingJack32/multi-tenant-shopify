import base64
from datetime import datetime, timezone
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
        wh = SvixWebhook(settings.svix_webhook_secret)
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





