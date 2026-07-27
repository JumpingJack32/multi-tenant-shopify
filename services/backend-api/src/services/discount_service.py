"""Discount service — validation and atomic usage increment."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.promotion import Promotion
from src.orm.schemas.promotion import ValidatePromotionResponse


async def validate_promotion(
    db: AsyncSession,
    tenant_id: UUID,
    code: str,
    subtotal: int,
) -> ValidatePromotionResponse:
    """Validate a promo code and compute the discount."""
    normalized = code.strip().upper()
    promo = (
        await db.exec(
            select(Promotion).where(
                Promotion.tenant_id == tenant_id,
                Promotion.code == normalized,
            )
        )
    ).first()

    if not promo:
        return ValidatePromotionResponse(valid=False, message="Invalid promo code")

    if not promo.is_active:
        return ValidatePromotionResponse(valid=False, message="This promo code is no longer active")

    now = datetime.now(timezone.utc)
    if promo.starts_at and now < promo.starts_at:
        return ValidatePromotionResponse(valid=False, message="This promo code is not yet active")

    if promo.ends_at and now > promo.ends_at:
        return ValidatePromotionResponse(valid=False, message="This promo code has expired")

    if promo.max_uses is not None and promo.uses_count >= promo.max_uses:
        return ValidatePromotionResponse(valid=False, message="This promo code has reached its usage limit")

    if promo.min_subtotal and subtotal < promo.min_subtotal:
        return ValidatePromotionResponse(
            valid=False,
            message=f"Minimum order of ${promo.min_subtotal / 100:.2f} required",
        )

    discount = promo.value if promo.type == "fixed_amount" else round(subtotal * promo.value / 10000)

    if promo.type == "fixed_amount":
        discount = min(discount, subtotal)

    return ValidatePromotionResponse(
        valid=True,
        discount=discount,
        type=promo.type,
        value=promo.value,
        message=f"{promo.code} applied — {promo.value}% off" if promo.type == "percentage" else f"${promo.value / 100:.2f} off",
    )


async def increment_uses(db: AsyncSession, promotion_id: UUID) -> None:
    """Atomically increment uses_count. Safe under concurrent checkout."""
    await db.execute(
        text("""
            UPDATE promotions
            SET uses_count = uses_count + 1
            WHERE id = :id AND (max_uses IS NULL OR uses_count < max_uses)
        """),
        {"id": promotion_id},
    )
