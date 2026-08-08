"""Guest customer-portal verification and identity tokens.

Guests stay password-free. They are verified by matching a PAID order for the
tenant using (email + order_number) or (email + shipping zip). A short-lived
signed token proves inbox/order ownership without forcing registration.
"""

from datetime import timedelta
from uuid import UUID

from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.security import create_access_token, decode_token
from src.orm.models.order import Order, OrderStatus

GUEST_TOKEN_TTL_MINUTES = 15
GUEST_COOKIE_MAX_AGE = 900  # 15 minutes in seconds


def normalize_email(email: str) -> str:
    return (email or "").lower().strip()


async def verify_guest(
    db: AsyncSession,
    tenant_id: UUID,
    email: str,
    order_number: str | None = None,
    shipping_zip: str | None = None,
) -> bool:
    """A guest is verified if they have a PAID order for this tenant whose
    email matches AND (order_number OR shipping zip) matches."""
    email = normalize_email(email)
    if not email:
        return False
    if not order_number and not shipping_zip:
        return False

    stmt = select(Order.id).where(
        Order.tenant_id == tenant_id,
        Order.customer_email == email,
        Order.status == OrderStatus.PAID,
    )
    if order_number:
        stmt = stmt.where(Order.order_number == order_number.strip().upper())
    if shipping_zip:
        clean_zip = shipping_zip.strip().upper()
        stmt = stmt.where(
            or_(
                Order.shipping_address["postal_code"].as_string() == clean_zip,
                Order.shipping_address["zip"].as_string() == clean_zip,
            )
        )
    stmt = stmt.limit(1)

    result = await db.exec(stmt)
    return result.first() is not None


def create_guest_portal_token(email: str, tenant_id: UUID, expires_in_minutes: int = GUEST_TOKEN_TTL_MINUTES) -> str:
    """Signed short-lived token proving guest ownership of the email."""
    return create_access_token(
        {"guest_customer": normalize_email(email), "tenant_id": str(tenant_id)},
        expires_delta=timedelta(minutes=expires_in_minutes),
    )


def parse_guest_portal_token(token: str) -> dict | None:
    """Verify a guest token. Returns claims dict or None if invalid/expired."""
    try:
        payload = decode_token(token)
    except ValueError:
        return None
    if not payload.get("guest_customer") or not payload.get("tenant_id"):
        return None
    return payload


def build_guest_cookie(token: str) -> dict:
    """Return kwargs for a secure guest cookie."""
    return {
        "key": "guest_customer",
        "value": token,
        "httponly": True,
        "samesite": "lax",
        "secure": True,
        "max_age": GUEST_COOKIE_MAX_AGE,
    }


def clear_guest_cookie() -> dict:
    """Return kwargs to delete the guest cookie."""
    return {
        "key": "guest_customer",
        "value": "",
        "httponly": True,
        "samesite": "lax",
        "secure": True,
        "max_age": 0,
    }
