"""convert variant.price to integer cents, drop product.price

Ensures Variant.price is stored as INTEGER cents matching the project's
integer-cents design pattern (already used by orders, order_items, customers).
Also drops the redundant Product.price column — price lives on variants only.

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-11
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop Product.price — price lives on variants only
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS price")

    # Convert variant.price from FLOAT to INTEGER cents
    # Existing seed data already stores cent values (e.g. 29999)
    op.execute("""
        ALTER TABLE variants ALTER COLUMN price TYPE INTEGER USING price::integer
    """)
    op.execute("ALTER TABLE variants ALTER COLUMN price SET DEFAULT 0")
    op.execute("ALTER TABLE variants DROP CONSTRAINT IF EXISTS variants_price_check")
    op.execute("ALTER TABLE variants ADD CONSTRAINT variants_price_check CHECK (price >= 0)")


def downgrade() -> None:
    op.execute("ALTER TABLE variants DROP CONSTRAINT IF EXISTS variants_price_check")
    op.execute("""
        ALTER TABLE variants ALTER COLUMN price TYPE DOUBLE PRECISION USING price::double precision
    """)
    op.execute("ALTER TABLE variants ALTER COLUMN price SET DEFAULT 0")
    op.execute("""
        ALTER TABLE products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NOT NULL DEFAULT 0.00
    """)
