"""Abandoned cart detection and email reminder service."""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import selectinload
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.orm.models.cart import Cart, CartStatus
from src.orm.models.tenant import Tenant
from src.services.email_service import EmailService

ABANDONMENT_HOURS = 2
POLL_LIMIT = 50
RETRY_COOLDOWN_HOURS = 24

logger = logging.getLogger(__name__)


def sign_unsubscribe_token(cart_id: UUID, email: str, secret: str) -> str:
    """Create HMAC-SHA256 token for unsubscribe link."""
    payload = json.dumps({"cart_id": str(cart_id), "email": email}, sort_keys=True)
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_unsubscribe_token(token: str, secret: str) -> dict:
    """Verify HMAC-SHA256 token and return payload dict."""
    try:
        payload_str, sig = token.rsplit(":", 1)
        expected = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("Invalid token")
        return json.loads(payload_str)
    except (ValueError, json.JSONDecodeError) as e:
        raise ValueError("Invalid token") from e


def build_recovery_url(tenant_slug: str, cart_id: UUID) -> str:
    """Build recovery URL linking back to the storefront cart.
    NOTE: The host is set to tenant_slug as a local placeholder.
    In production this should use the tenant's actual domain from settings."""
    return f"https://{tenant_slug}/cart?recover={cart_id}"


class AbandonedCartService:
    """Finds abandoned carts and sends reminder emails."""

    def __init__(self, db: AsyncSession, email_service: EmailService):
        self.db = db
        self.email_service = email_service

    async def process_abandoned_carts(self) -> int:
        """Find abandoned carts, stamp + commit, then send emails. Returns count sent."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ABANDONMENT_HOURS)
        cooldown = datetime.now(timezone.utc) - timedelta(hours=RETRY_COOLDOWN_HOURS)

        stmt = (
            select(Cart)
            .options(selectinload(Cart.items))
            .where(
                Cart.status == CartStatus.ACTIVE,
                Cart.email.isnot(None),
                Cart.unsubscribed == False,  # noqa: E712 — SQLAlchemy column expression, not plain bool
                Cart.updated_at < cutoff,
                or_(
                    Cart.last_reminded_at.is_(None),
                    Cart.last_reminded_at < cooldown,
                ),
            )
            .order_by(Cart.updated_at.asc())
            .limit(POLL_LIMIT)
            .with_for_update(skip_locked=True)
        )

        result = await self.db.execute(stmt)
        carts = result.scalars().all()

        if not carts:
            await self.db.commit()
            return 0

        # Batch-fetch tenants to avoid N+1
        tenant_ids = {c.tenant_id for c in carts if c.tenant_id}
        tenant_stmt = select(Tenant).where(Tenant.tenant_id.in_(tenant_ids))
        tenant_result = await self.db.execute(tenant_stmt)
        tenant_map = {t.tenant_id: t for t in tenant_result.scalars().all()}

        # Extract payload and stamp before commit
        payloads = []
        for cart in carts:
            cart.last_reminded_at = datetime.now(timezone.utc)
            tenant = tenant_map.get(cart.tenant_id) if cart.tenant_id else None
            payloads.append({
                "id": cart.id,
                "email": cart.email,
                "items": [
                    {
                        "id": str(i.id) if hasattr(i, "id") else None,
                        "product_name": i.variant.product.name if i.variant and i.variant.product else "Product",
                        "quantity": i.quantity,
                        "unit_price": i.variant.price if i.variant else 0,
                    }
                    for i in cart.items
                ],
                "tenant_slug": tenant.slug if tenant else "store",
                "tenant_name": tenant.name if tenant else "Store",
            })

        await self.db.commit()

        # Network I/O outside transaction
        for payload in payloads:
            try:
                recovery_url = build_recovery_url(payload["tenant_slug"], payload["id"])
                unsub_token = sign_unsubscribe_token(
                    payload["id"], payload["email"], settings.jwt_secret
                )
                await self.email_service.send_abandoned_cart(
                    to_email=payload["email"],
                    cart=payload,
                    recovery_url=recovery_url,
                    tenant_name=payload["tenant_name"],
                    unsubscribe_token=unsub_token,
                )
            except Exception:
                logger.exception(
                    "Failed to send abandoned cart email for cart %s",
                    payload["id"],
                )

        return len(payloads)
