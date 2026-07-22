#!/usr/bin/env python3
"""Generate a signed Stripe webhook event and send it to the local backend."""
import hashlib
import hmac
import json
import sys
import time
import httpx
import asyncio


async def main():
    api_base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
    session_id = sys.argv[2] if len(sys.argv) > 2 else ""

    if not session_id:
        # Create a session first
        async with httpx.AsyncClient() as c:
            prod_res = await c.get(f"{api_base}/api/v1/storefront/acme-corp/products?page_size=1")
            variant_id = prod_res.json()["data"][0]["variants"][0]["id"]
            sess_res = await c.post(
                f"{api_base}/api/v1/storefront/acme-corp/checkout/session",
                json={"items": [{"variant_id": variant_id, "quantity": 1}], "customer_email": "test@example.com"},
            )
            session_id = sess_res.json()["session_id"]

    # Get the webhook secret from the backend settings via env
    webhook_secret = ""
    import os
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    # Build the event payload
    payload = json.dumps({
        "id": f"evt_{int(time.time())}",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "payment_status": "paid",
                "status": "complete",
                "metadata": {"tenant_slug": "acme-corp"},
            }
        },
    })

    # Generate signature using the algorithm stripe.WebhookSignature.verify_header expects
    # Format: t={timestamp},v1={hex_hmac_sha256(secret, "{timestamp}.{payload}")}
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload}"
    signature = hmac.new(webhook_secret.encode(), signed_payload.encode(), hashlib.sha256).hexdigest()
    sig_header = f"t={timestamp},v1={signature}"

    # Verify with Stripe SDK
    import stripe
    try:
        stripe.WebhookSignature.verify_header(payload, sig_header, webhook_secret)
        print("Signature verification: OK", file=sys.stderr)
    except Exception as e:
        print(f"Signature verification FAILED: {e}", file=sys.stderr)
        sys.exit(1)

    # Send to backend
    async with httpx.AsyncClient() as c:
        wh_res = await c.post(
            f"{api_base}/api/v1/storefront/webhooks/stripe",
            content=payload,
            headers={"stripe-signature": sig_header, "Content-Type": "application/json"},
        )
        data = wh_res.json()
        print(f"Webhook: {wh_res.status_code}, order_id: {data.get('order_id')}", file=sys.stderr)

        # Return order info
        order_res = await c.get(f"{api_base}/api/v1/storefront/acme-corp/orders/by-session/{session_id}")
        if order_res.status_code == 200:
            order = order_res.json()
            print(json.dumps({"session_id": session_id, "order_id": str(order["id"]), "status": order["status"]}))
        else:
            print(json.dumps({"session_id": session_id, "order_id": None, "status": "not_found"}))


if __name__ == "__main__":
    asyncio.run(main())
