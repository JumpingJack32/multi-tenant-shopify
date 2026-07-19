"""add order stripe fields

Revision ID: 0015
Revises: 0014
Create Date: 2026-07-19 21:45:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customer_email", sa.String(length=255), nullable=True))
    op.add_column("orders", sa.Column("stripe_client_secret", sa.String(length=255), nullable=True))
    op.create_index(op.f("ix_orders_customer_email"), "orders", ["customer_email"])
    op.create_index(op.f("ix_orders_payment_intent"), "orders", ["payment_intent_id"], unique=True)

    # Extend orderstatus enum via raw SQL
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'PAYMENT_PROCESSING'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED'")
    # Extend paymentstatus enum
    op.execute("ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS 'PROCESSING'")


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_payment_intent"), table_name="orders")
    op.drop_index(op.f("ix_orders_customer_email"), table_name="orders")
    op.drop_column("orders", "stripe_client_secret")
    op.drop_column("orders", "customer_email")
    # Note: PostgreSQL does not support removing enum values in a downgrade.
    # The added enum values will remain but won't cause issues.
