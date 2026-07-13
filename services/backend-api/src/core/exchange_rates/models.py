from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import Field, SQLModel, UniqueConstraint


class ExchangeRate(SQLModel, table=True):
    __tablename__ = "exchange_rates"
    __table_args__ = (
        UniqueConstraint(
            "source_currency", "target_currency",
            name="uq_exchange_rate_pair",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    source_currency: str = Field(max_length=3, index=True, nullable=False)
    target_currency: str = Field(max_length=3, index=True, nullable=False)
    rate: Decimal = Field(max_digits=12, decimal_places=8, nullable=False)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": datetime.now(timezone.utc)},
    )
