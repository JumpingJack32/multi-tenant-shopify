"""Email notification service for abandoned cart recovery."""

import logging
from abc import ABC, abstractmethod

import httpx

from src.config import settings

CURRENCY_SYMBOLS: dict[str, str] = {
    "GBP": "\u00a3",
    "USD": "$",
    "EUR": "\u20ac",
    "CAD": "$",
    "AUD": "$",
    "JPY": "\u00a5",
    "CHF": "Fr",
    "SEK": "kr",
    "NOK": "kr",
    "DKK": "kr",
    "PLN": "z\u0142",
    "CZK": "K\u010d",
    "HUF": "Ft",
    "BRL": "R$",
    "INR": "\u20b9",
    "CNY": "\u00a5",
    "SGD": "$",
    "HKD": "$",
    "NZD": "$",
    "ZAR": "R",
}

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
        currency: str,
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
        currency: str,
        unsubscribe_token: str,
    ) -> bool:
        item_count = len(cart.get("items", []))
        symbol = CURRENCY_SYMBOLS.get(currency, currency)
        logger.info(
            "Abandoned cart email to %s for '%s': %d items, total in %s (%s), recover at %s (unsub: %s)",
            to_email,
            tenant_name,
            item_count,
            currency,
            symbol,
            recovery_url,
            unsubscribe_token,
        )
        return True


class ResendEmailService(EmailService):
    """Production email service using Resend API."""

    def __init__(self, api_key: str, from_email: str = "noreply@yourplatform.com"):
        self.api_key = api_key
        self.from_email = from_email

    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,
        recovery_url: str,
        tenant_name: str,
        currency: str,
        unsubscribe_token: str,
    ) -> bool:
        from_email = self.from_email

        symbol = CURRENCY_SYMBOLS.get(currency, currency)
        items_html = "".join(
            f"""
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;">
                    <p style="margin:0;font-size:14px;">{i.get("product_name", "Product")}</p>
                    <p style="margin:4px 0 0;color:#666;font-size:12px;">Qty: {i.get("quantity", 0)}</p>
                </td>
                <td style="padding:12px 0;text-align:right;font-size:14px;">{symbol}{"%.2f" % (i.get("unit_price", 0) / 100)}</td>
            </tr>"""
            for i in cart.get("items", [])
        )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>You left items in your cart</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;font-weight:400;letter-spacing:-0.01em;">{tenant_name}</h1>
<p style="color:#666;font-size:14px;">You left items in your cart — they're still waiting for you.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0;">{items_html}</table>
<a href="{recovery_url}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:14px;">Complete Your Order</a>
<p style="margin-top:32px;font-size:12px;color:#999;">
<a href="https://yourplatform.com/api/v1/public/carts/unsubscribe/{unsubscribe_token}" style="color:#999;">Unsubscribe from cart reminders</a></p>
</body></html>"""

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": from_email,
                    "to": [to_email],
                    "subject": f"Your {tenant_name} cart is waiting",
                    "html": html,
                },
            )

        if response.status_code >= 400:
            logger.error(
                "Resend API error %d for %s: %s",
                response.status_code,
                to_email,
                response.text,
            )
            return False

        return True


def create_email_service() -> EmailService:
    """Factory — returns ResendEmailService when API key configured, else LogEmailService."""
    if settings.resend_api_key:
        return ResendEmailService(
            api_key=settings.resend_api_key,
            from_email=settings.resend_from_email,
        )
    return LogEmailService()
