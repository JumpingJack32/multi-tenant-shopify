from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, UniqueConstraint

from .base import TimestampMixin


class TaxRate(TimestampMixin, table=True):
    __tablename__ = "tax_rates" # type: ignore
    __table_args__ = (
        UniqueConstraint(
            "country_code",
            "state_province_code",
            "tax_name",
            name="uq_country_state_tax",
        ),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    country_code: str = Field(max_length=2, index=True, nullable=False)  # e.g., 'FR'
    state_province_code: Optional[str] = Field(
        default=None, max_length=10, index=True
    )  # Used for US/CA

    tax_name: str = Field(max_length=50, nullable=False)  # e.g., 'TVA', 'MwSt', 'VAT'
    tax_rate: Decimal = Field(
        max_digits=5, decimal_places=4, nullable=False
    )  # e.g., 0.2000
    is_compounded: bool = Field(default=False, nullable=False)

    def model_validator(self) -> "TaxRate":
        self.country_code = self.country_code.upper()
        if self.state_province_code:
            self.state_province_code = self.state_province_code.upper()
        if not (0 <= self.tax_rate <= 1):
            raise ValueError("Tax rate must be between 0.0000 and 1.0000")
        return self
