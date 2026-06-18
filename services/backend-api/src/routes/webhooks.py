from fastapi import APIRouter, Header, Request, HTTPException
from svix.webhooks import Webhook, WebhookVerificationError

router = APIRouter()


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("stripe-signature", "")

    try:
        wh = Webhook()
        wh.verify(payload=body.decode(), sig=signature, id="")
    except WebhookVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    return {"received": True}


@router.post("/webhooks/shopify")
async def shopify_webhook(request: Request):
    body = await request.body()
    hmac = request.headers.get("x-shopify-hmac-sha256", "")

    # TODO: verify Shopify HMAC signature
    return {"received": True}
