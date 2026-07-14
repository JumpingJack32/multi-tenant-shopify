"""Script to test ResendEmailService with a real delivery via verified domain.

Uses RESEND_FROM_EMAIL from Doppler (should be noreply@notify.amoagou.com).
Run with: doppler run -- uv run python scripts/test_resend_email.py
"""

import asyncio
import logging
import sys

sys.path.insert(0, ".")

from src.config import settings
from src.services.email_service import ResendEmailService

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# CHANGE THIS to your real email address
TEST_RECEIVER_EMAIL = "giogunn32@protonmail.com"


async def main():
    if not settings.resend_api_key:
        logger.error("RESEND_API_KEY is not set — doppler run required.")
        sys.exit(1)

    svc = ResendEmailService(
        api_key=settings.resend_api_key,
        from_email=settings.resend_from_email,
    )

    dummy_cart = {
        "items": [
            {"product_name": "Test Product", "quantity": 1, "unit_price": 2999},
            {"product_name": "Another Item", "quantity": 2, "unit_price": 1499},
        ]
    }

    logger.info(f"Sending from {settings.resend_from_email} to {TEST_RECEIVER_EMAIL}...")
    result = await svc.send_abandoned_cart(
        to_email=TEST_RECEIVER_EMAIL,
        cart=dummy_cart,
        recovery_url="https://example.com/cart?recover=test123",
        tenant_name="Test Store",
        currency="GBP",
        unsubscribe_token="test_unsub_token",
    )

    if result:
        logger.info(f"SUCCESS: Email sent from {settings.resend_from_email} to {TEST_RECEIVER_EMAIL} — check your inbox.")
    else:
        logger.error("FAILED: ResendEmailService returned False. Check logs above for API error details.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
