"""ensure orders stripe columns exist (fix for 0015)

Revision ID: 0016
Revises: 0015
Create Date: 2026-07-19 22:15:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)"
    )
    op.execute(
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_client_secret VARCHAR(255)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_orders_customer_email ON orders (customer_email)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_orders_payment_intent ON orders (payment_intent_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_orders_payment_intent")
    op.execute("DROP INDEX IF EXISTS ix_orders_customer_email")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS stripe_client_secret")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS customer_email")
