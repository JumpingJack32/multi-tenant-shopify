"""Price conversion service for multi-currency storefront display."""

from decimal import Decimal
from uuid import UUID

from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.exchange_rates.service import RateService


async def convert_price(
    amount_pence: int,
    from_currency: str,
    to_currency: str,
    db: AsyncSession,
) -> int:
    """Convert a price from one currency to another.

    Args:
        amount_pence: Price in the source currency's minor unit (e.g. 10000 = £100.00).
        from_currency: Source currency code (e.g. "GBP").
        to_currency: Target currency code (e.g. "USD").
        db: Database session for rate lookup fallback.

    Returns:
        Price in the target currency's minor unit (e.g. 13000 = $130.00).
    """
    if from_currency == to_currency:
        return amount_pence

    svc = RateService()
    amount_major = Decimal(amount_pence) / 100
    return await svc.convert(amount_major, from_currency, to_currency, db)
