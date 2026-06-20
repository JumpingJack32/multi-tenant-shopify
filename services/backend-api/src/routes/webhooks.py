import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.dependencies import get_db

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


# ── Svix Webhook ─────────────────────────────────────────────────────────


@router.post("/svix")
async def svix_webhook(
    request: Request,
    svix_signature: str = Header(None, alias="Svix-Signature"),
    svix_timestamp: str = Header(None, alias="Svix-Timestamp"),
):
    """Handle Svix webhook relay."""
    body = await request.body()

    if not svix_signature or not svix_timestamp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Svix headers",
        )

    # TODO: Verify Svix signature
    # For now, process the event
    try:
        event_data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    event_type = event_data.get("type", "")
    payload = event_data.get("payload", {})

    if event_type == "user.created":
        # Handle new user creation
        pass
    elif event_type == "order.created":
        # Handle order creation
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
    """Handle Shopify webhooks."""
    body = await request.body()

    if not hmac_header or not shop:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Shopify headers",
        )

    # TODO: Verify Shopify HMAC signature
    # For now, process the event
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    if topic == "orders/create":
        # Process new order from Shopify
        pass
    elif topic == "orders/paid":
        # Update payment status
        pass

    return {"status": "received"}



