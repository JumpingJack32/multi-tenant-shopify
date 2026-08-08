"""add stripe_customer_id to orders

Revision ID: 18cddd76f356
Revises: 18cddd76f355
Create Date: 2026-08-07 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f356"
down_revision: Union[str, None] = "18cddd76f355"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_orders_stripe_customer_id ON orders (stripe_customer_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_orders_stripe_customer_id")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS stripe_customer_id")
