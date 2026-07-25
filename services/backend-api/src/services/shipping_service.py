"""Shipping rate calculation service — flat-rate and threshold tiers."""

from decimal import Decimal

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.shipping import ShippingMethod
from src.orm.schemas.shipping import ShippingRateResult


async def calculate_shipping_rates(
    db: AsyncSession,
    tenant_id: str,
    subtotal: int,
) -> list[ShippingRateResult]:
    """Return applicable shipping methods with calculated costs.

    Args:
        subtotal: Cart subtotal in pence.
    """
    result = await db.exec(
        select(ShippingMethod).where(
            ShippingMethod.tenant_id == tenant_id,
            ShippingMethod.is_active == True,
        )
    )
    methods = result.all()

    rates: list[ShippingRateResult] = []
    subtotal_decimal = Decimal(subtotal) / Decimal("100")

    for method in methods:
        cost = Decimal("0")
        is_free = False

        if method.rate_type == "THRESHOLD":
            if method.free_shipping_threshold and subtotal_decimal >= method.free_shipping_threshold:
                cost = Decimal("0")
                is_free = True
            else:
                cost = method.base_price
        else:
            cost = method.base_price

        rates.append(
            ShippingRateResult(
                method_id=method.id,
                name=method.name,
                cost=cost,
                is_free=is_free,
            )
        )

    return rates
