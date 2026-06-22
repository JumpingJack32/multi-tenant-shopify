from datetime import datetime, timezone
# from decimal import Decimal
# from typing import Optional
from sqlmodel import Field, SQLModel


class TimestampMixin(SQLModel):
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"type_": "TIMESTAMPTZ"},
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={
            "type_": "TIMESTAMPTZ",
            "onupdate": datetime.now(timezone.utc),
        },
    )
