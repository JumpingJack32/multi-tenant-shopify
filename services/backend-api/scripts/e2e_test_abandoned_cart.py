"""End-to-end test: seed an abandoned cart and immediately process it.

Creates a test cart that qualifies as abandoned (3h old), then runs the
AbandonedCartService to send a real recovery email via Resend.

Run: doppler run -- uv run python scripts/e2e_test_abandoned_cart.py
"""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
import sys
from uuid import uuid4

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

sys.path.insert(0, ".")

from src.database import async_engine
from src.orm.models.cart import Cart, CartItem, CartStatus
from src.orm.models.product import Variant
from src.orm.models.tenant import Tenant
from src.services.abandoned_cart import AbandonedCartService
from src.services.email_service import create_email_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

TEST_RECEIVER_EMAIL = "giogunn32@protonmail.com"


async def main():
    async with AsyncSession(async_engine) as session:
        tenant_stmt = select(Tenant).limit(1)
        tenant = (await session.exec(tenant_stmt)).first()
        if not tenant:
            logger.error("No tenant found — seed the database first.")
            sys.exit(1)

        variant_stmt = select(Variant).limit(1)
        variant = (await session.exec(variant_stmt)).first()
        if not variant:
            logger.error("No variants found — seed the database first.")
            sys.exit(1)

        logger.info(f"Tenant: {tenant.name} ({tenant.slug})")
        logger.info(f"Variant: {variant.id} — £{variant.price / 100:.2f}")
        logger.info(f"Recipient: {TEST_RECEIVER_EMAIL}")

        # Remove any existing test carts for this email to avoid duplicates
        existing = await session.exec(
            select(Cart).where(Cart.email == TEST_RECEIVER_EMAIL)
        )
        for c in existing.all():
            await session.delete(c)
        await session.flush()

        cart = Cart(
            id=uuid4(),
            tenant_id=tenant.tenant_id,
            email=TEST_RECEIVER_EMAIL,
            status=CartStatus.ACTIVE,
            unsubscribed=False,
            last_reminded_at=None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        session.add(cart)
        await session.flush()
        cart_id = cart.id

        item = CartItem(
            id=uuid4(), cart_id=cart_id, variant_id=variant.id, quantity=2
        )
        session.add(item)
        cart.updated_at = datetime.now(timezone.utc) - timedelta(hours=3)

        await session.commit()
        logger.info(f"Seeded cart {cart_id} — 3 hours old, ready for processing")

        # Process abandoned carts in same session — commit done inside service
        email_service = create_email_service()
        svc = AbandonedCartService(session, email_service)
        count = await svc.process_abandoned_carts()

        if count > 0:
            logger.info(f"SUCCESS: {count} abandoned cart email(s) sent to {TEST_RECEIVER_EMAIL}")
        else:
            logger.error("No abandoned carts were processed — check service query conditions")
            sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
