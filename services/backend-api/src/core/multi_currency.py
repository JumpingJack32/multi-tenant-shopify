from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, UniqueConstraint
from .base import TimestampMixin


class VariantPrice(TimestampMixin, table=True):  # noqa: F821
    __tablename__ = "variant_prices" # type: ignore
    __table_args__ = (
        UniqueConstraint(
            "variant_id", "currency", "country_code", name="uq_variant_market"
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Replace 'product_variants.id' with your actual variant parent table name
    variant_id: UUID = Field(
        foreign_key="product_variants.id", index=True, nullable=False
    )

    currency: str = Field(
        max_length=3, index=True, nullable=False
    )  # e.g., 'EUR', 'GBP'
    country_code: str = Field(
        max_length=2, index=True, nullable=False
    )  # e.g., 'FR', 'DE'

    # Using Decimal to prevent floating-point precision loss in financial fields
    price: Decimal = Field(
        default=Decimal("0.00"), max_digits=12, decimal_places=2, nullable=False
    )
    compare_at_price: Optional[Decimal] = Field(
        default=None, max_digits=12, decimal_places=2
    )

    # Pydantic validation and clean data hooks
    def model_validator(self) -> "VariantPrice":
        self.currency = self.currency.upper()
        self.country_code = self.country_code.upper()
        if self.price < 0:
            raise ValueError("Price cannot be negative")
        if self.compare_at_price is not None and self.compare_at_price < 0:
            raise ValueError("Compare at price cannot be negative")
        return self
