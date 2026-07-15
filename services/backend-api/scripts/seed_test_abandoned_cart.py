"""Script to seed an eligible abandoned cart for end-to-end testing."""

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

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# CHANGE THIS to your test email to verify delivery
TEST_RECEIVER_EMAIL = "giogunn32@protonmail.com"


async def seed_abandoned_cart():
    async with AsyncSession(async_engine) as session:
        tenant_stmt = select(Tenant).limit(1)
        tenant = (await session.execute(tenant_stmt)).scalars().first()

        if not tenant:
            logger.error("No tenants found in the database. Please seed a tenant first.")
            return

        variant_stmt = select(Variant).limit(1)
        variant = (await session.execute(variant_stmt)).scalars().first()

        if not variant:
            logger.error("No product variants found in the database. Please seed products first.")
            return

        logger.info(f"Using Tenant: '{tenant.name}' ({tenant.slug})")
        logger.info(f"Using Variant: '{variant.id}' priced at {variant.price} cents")

        abandoned_time = datetime.now(timezone.utc) - timedelta(hours=3)

        test_cart = Cart(
            id=uuid4(),
            tenant_id=tenant.tenant_id,
            email=TEST_RECEIVER_EMAIL,
            status=CartStatus.ACTIVE,
            unsubscribed=False,
            last_reminded_at=None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        )
        session.add(test_cart)
        await session.flush()

        cart_item = CartItem(
            id=uuid4(),
            cart_id=test_cart.id,
            variant_id=variant.id,
            quantity=2,
        )
        session.add(cart_item)

        test_cart.updated_at = abandoned_time

        await session.commit()

        logger.info("Successfully seeded eligible abandoned cart!")
        logger.info(f"Cart ID: {test_cart.id}")
        logger.info(f"Target Email: {TEST_RECEIVER_EMAIL}")
        logger.info(f"Simulated Abandonment Time: {abandoned_time}")
        logger.info("👉 Run your local server now via Doppler. The background worker should capture this within 15 minutes.")


if __name__ == "__main__":
    asyncio.run(seed_abandoned_cart())
