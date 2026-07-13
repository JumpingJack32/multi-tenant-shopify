"""Email notification service for abandoned cart recovery."""

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class EmailService(ABC):
    """Abstract email service interface."""

    @abstractmethod
    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,
        recovery_url: str,
        tenant_name: str,
        unsubscribe_token: str,
    ) -> bool:
        """Send abandoned cart reminder email. Returns True on success."""
        ...


class LogEmailService(EmailService):
    """Mock email service that logs instead of sending."""

    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,
        recovery_url: str,
        tenant_name: str,
        unsubscribe_token: str,
    ) -> bool:
        item_count = len(cart.get("items", []))
        logger.info(
            "Abandoned cart email to %s for '%s': %d items, recover at %s (unsub: %s)",
            to_email,
            tenant_name,
            item_count,
            recovery_url,
            unsubscribe_token,
        )
        return True


def create_email_service() -> EmailService:
    """Factory — returns LogEmailService until Resend is configured."""
    return LogEmailService()
