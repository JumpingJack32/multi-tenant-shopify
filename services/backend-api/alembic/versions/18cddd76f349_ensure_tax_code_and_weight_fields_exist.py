"""ensure tax_code and weight fields exist (fix for op.add_column persistence issue)

Revision ID: 18cddd76f349
Revises: 18cddd76f348
Create Date: 2026-07-27 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "18cddd76f349"
down_revision: Union[str, None] = "18cddd76f348"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE variants ADD COLUMN IF NOT EXISTS tax_code VARCHAR(50)")
    op.execute("ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS min_weight NUMERIC(10, 2)")
    op.execute("ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS max_weight NUMERIC(10, 2)")
    op.execute("ALTER TABLE shipping_methods ADD COLUMN IF NOT EXISTS price_per_unit_weight NUMERIC(10, 4)")


def downgrade() -> None:
    op.execute("ALTER TABLE variants DROP COLUMN IF EXISTS tax_code")
    op.execute("ALTER TABLE shipping_methods DROP COLUMN IF EXISTS price_per_unit_weight")
    op.execute("ALTER TABLE shipping_methods DROP COLUMN IF EXISTS max_weight")
    op.execute("ALTER TABLE shipping_methods DROP COLUMN IF EXISTS min_weight")
