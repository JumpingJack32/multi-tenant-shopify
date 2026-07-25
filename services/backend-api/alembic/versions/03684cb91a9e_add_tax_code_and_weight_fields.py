"""add tax_code to variants and weight fields to shipping_methods

Revision ID: 03684cb91a9e
Revises: 03684cb91a9d
Create Date: 2026-07-25 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "03684cb91a9e"
down_revision: Union[str, None] = "03684cb91a9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("variants", sa.Column("tax_code", sa.String(length=50), nullable=True))
    op.add_column("shipping_methods", sa.Column("min_weight", sa.Numeric(10, 2), nullable=True))
    op.add_column("shipping_methods", sa.Column("max_weight", sa.Numeric(10, 2), nullable=True))
    op.add_column("shipping_methods", sa.Column("price_per_unit_weight", sa.Numeric(10, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("variants", "tax_code")
    op.drop_column("shipping_methods", "price_per_unit_weight")
    op.drop_column("shipping_methods", "max_weight")
    op.drop_column("shipping_methods", "min_weight")
