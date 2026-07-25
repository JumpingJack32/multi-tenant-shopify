"""Shipping rate calculation service — flat-rate, threshold, and weight-based tiers."""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.shipping import ShippingMethod
from src.orm.schemas.shipping import ShippingRateResult

KG_CONVERSION = {
    "kg": Decimal("1"),
    "g": Decimal("0.001"),
    "lb": Decimal("0.45359237"),
    "oz": Decimal("0.028349523125"),
}


async def calculate_shipping_rates(
    db: AsyncSession,
    tenant_id: str,
    subtotal: int,
    items: Optional[list[dict]] = None,
) -> list[ShippingRateResult]:
    """Return applicable shipping methods with calculated costs.

    Args:
        subtotal: Cart subtotal in pence.
        items: Optional list of {variant_id, quantity} for weight calculation.
    """
    result = await db.exec(
        select(ShippingMethod).where(
            ShippingMethod.tenant_id == tenant_id,
            ShippingMethod.is_active == True,
        )
    )
    methods = result.all()

    total_weight_kg = Decimal("0")
    if items:
        from src.orm.models.product import Variant

        for cart_item in items:
            v = (
                await db.exec(select(Variant).where(Variant.id == cart_item["variant_id"]))
            ).first()
            if v and v.weight:
                unit = (v.weight_unit or "kg").lower()
                factor = KG_CONVERSION.get(unit, Decimal("1"))
                total_weight_kg += Decimal(str(v.weight)) * factor * cart_item["quantity"]

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
        elif method.rate_type == "WEIGHT_BASED" and total_weight_kg > 0:
            if method.min_weight and total_weight_kg < method.min_weight:
                continue
            if method.max_weight and total_weight_kg > method.max_weight:
                continue
            cost = method.base_price + (total_weight_kg * (method.price_per_unit_weight or Decimal("0")))
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
