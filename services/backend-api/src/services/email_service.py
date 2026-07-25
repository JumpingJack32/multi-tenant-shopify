"""Email notification service for abandoned cart recovery and transactional emails."""

from abc import ABC, abstractmethod
import logging
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader, select_autoescape

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

# ── Jinja2 email template rendering ────────────────────────────────

TEMPLATES_DIR = Path(__file__).parent.parent / "email-templates"
_jinja_env: Environment | None = None


def _get_jinja_env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


def render_jinja_string(template_str: str, **context) -> str:
    """Render a Jinja2 string (e.g. a subject line) with context."""
    from jinja2 import Environment
    env = Environment(autoescape=False)
    return env.from_string(template_str).render(**context)


def render_email_template(name: str, **context) -> str:
    """Render a Jinja2 email template with auto-escaping.

    Templates are pre-compiled React Email components with Jinja2 tokens
    ({{ ... }}, {% ... %}) embedded as literal text. This function evaluates
    those tokens against the provided context dict.
    """
    env = _get_jinja_env()
    template = env.get_template(f"{name}.html")
    return template.render(**context)


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

    @abstractmethod
    async def send_order_confirmation(
        self,
        to_email: str,
        order: dict,
        tenant_name: str,
        currency: str,
        account_url: str,
    ) -> bool:
        """Send order confirmation email. Returns True on success."""
        ...

    @abstractmethod
    async def send_shipping_notification(
        self,
        to_email: str,
        order: dict,
        fulfillment: dict,
        tenant_name: str,
    ) -> bool:
        """Send shipping notification with tracking link. Returns True on success."""
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

    async def send_order_confirmation(
        self,
        to_email: str,
        order: dict,
        tenant_name: str,
        currency: str,
        account_url: str,
    ) -> bool:
        logger.info(
            "Order confirmation email to %s for '%s': order %s, total %s %s",
            to_email,
            tenant_name,
            order.get("order_number"),
            currency,
            order.get("total", 0),
        )
        return True

    async def send_shipping_notification(
        self,
        to_email: str,
        order: dict,
        fulfillment: dict,
        tenant_name: str,
    ) -> bool:
        logger.info(
            "Shipping notification email to %s for '%s': order %s, carrier %s, tracking %s",
            to_email,
            tenant_name,
            order.get("order_number"),
            fulfillment.get("carrier"),
            fulfillment.get("tracking_number"),
        )
        return True


class ResendEmailService(EmailService):
    """Production email service using Resend API."""

    def __init__(self, api_key: str, from_email: str = "noreply@notify.amoagou.com"):
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

    async def send_order_confirmation(
        self,
        to_email: str,
        order: dict,
        tenant_name: str,
        currency: str,
        account_url: str,
    ) -> bool:
        symbol = CURRENCY_SYMBOLS.get(currency, currency)
        items_html = "".join(
            f"""
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px 0;font-size:14px;">{i.get("product_name", "Product")}</td>
                <td style="padding:12px 0;font-size:13px;color:#666;">{i.get("variant_name", "")}</td>
                <td style="padding:12px 0;text-align:center;font-size:14px;">{i.get("quantity", 0)}</td>
                <td style="padding:12px 0;text-align:right;font-size:14px;">{symbol}{"%.2f" % (i.get("total_price", 0) / 100)}</td>
            </tr>"""
            for i in order.get("items", [])
        )
        shipping = order.get("shipping_address", {})
        address_html = f"{shipping.get('line1', '')}<br/>{shipping.get('city', '')} {shipping.get('postal_code', '')}" if shipping else ""

        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Order Confirmed — {order.get("order_number", "")}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;font-weight:400;">{tenant_name}</h1>
<p style="color:#666;font-size:14px;">Your order <strong>{order.get("order_number", "")}</strong> has been confirmed.</p>
<table style="width:100%;border-collapse:collapse;margin:24px 0;">
<tr style="border-bottom:2px solid #ddd;"><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">Item</th><th style="text-align:left;padding:8px 0;font-size:12px;color:#666;">Variant</th><th style="text-align:center;padding:8px 0;font-size:12px;color:#666;">Qty</th><th style="text-align:right;padding:8px 0;font-size:12px;color:#666;">Total</th></tr>
{items_html}</table>
<table style="width:100%;margin:16px 0;"><tr><td style="text-align:right;font-size:14px;font-weight:600;">Total: {symbol}{"%.2f" % (order.get("total", 0) / 100)}</td></tr></table>
<hr style="border:none;border-top:1px solid #eee;"/>
<p style="font-size:13px;color:#666;">{address_html}</p>
<p style="margin-top:24px;"><a href="{account_url}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:14px;">View Order</a></p>
</body></html>"""
        return await self.send_raw(to_email, f"Order Confirmed — {order.get('order_number', '')}", html)

    async def send_shipping_notification(
        self,
        to_email: str,
        order: dict,
        fulfillment: dict,
        tenant_name: str,
    ) -> bool:
        tracking_url = fulfillment.get("tracking_url") or ""
        tracking_number = fulfillment.get("tracking_number") or ""
        carrier = fulfillment.get("carrier") or ""
        items_list = fulfillment.get("items", []) or []
        items_html = "".join(
            f"""<tr style="border-bottom:1px solid #eee;"><td style="padding:8px 0;font-size:14px;">{i.get("product_name", "Product")}</td><td style="padding:8px 0;text-align:right;font-size:14px;">x{i.get("quantity", 0)}</td></tr>"""
            for i in items_list
        )

        html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Your order has shipped — {order.get("order_number", "")}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;font-weight:400;">{tenant_name}</h1>
<p style="color:#666;font-size:14px;">Your order <strong>{order.get("order_number", "")}</strong> is on its way.</p>
<table style="width:100%;margin:24px 0;"><tr><td style="padding:16px;background:#f5f5f5;border-radius:8px;">
<p style="margin:0 0 4px;font-size:14px;">{carrier}{" — " + tracking_number if tracking_number else ""}</p>
{"<a href='" + tracking_url + "' style='display:inline-block;margin-top:8px;color:#000;font-size:13px;'>Track Shipment →</a>" if tracking_url else ""}
</td></tr></table>
<table style="width:100%;border-collapse:collapse;">{items_html}</table>
</body></html>"""
        return await self.send_raw(to_email, f"Your {tenant_name} order has shipped", html)

    async def send_raw(self, to_email: str, subject: str, html: str) -> bool:
        """Send an arbitrary HTML email via Resend."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": self.from_email,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
            )
        if response.status_code >= 400:
            logger.error("Resend API error %d for %s: %s", response.status_code, to_email, response.text)
            return False
        return True

    async def send_batch(self, emails: list[dict]) -> list[dict]:
        """Send up to 100 emails via Resend batch API.

        Each item: { from: str, to: [str], subject: str, html: str }.
        Returns list of { id, email } response objects in same order.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.resend.com/emails/batch",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=[{
                    "from": e.get("from", self.from_email),
                    "to": e["to"],
                    "subject": e["subject"],
                    "html": e["html"],
                } for e in emails],
            )

        if response.status_code >= 400:
            logger.error("Resend batch API error %d: %s", response.status_code, response.text)
            raise RuntimeError(f"Resend batch failed: {response.status_code}")

        return response.json()


def create_email_service() -> EmailService:
    """Factory — ResendEmailService when API key configured, else LogEmailService."""
    if settings.resend_api_key:
        return ResendEmailService(
            api_key=settings.resend_api_key,
            from_email=settings.resend_from_email,
        )
    return LogEmailService()
