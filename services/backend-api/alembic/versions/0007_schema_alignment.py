"""align ORM schema with migration output

Adds columns present in ORM models but missing from migrations 0001-5ffe6f1c9bd2.
Drops customer_email from orders (exists in 0001 but not in ORM).
Adds refunded_total to customers (exists in 0005 but was missing from ORM).

Revision ID: 0007
Revises: 5ffe6f1c9bd2
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "5ffe6f1c9bd2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- tenants: add columns present in ORM but not in 0001 ---
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain VARCHAR(255)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan VARCHAR(50) NOT NULL DEFAULT 'starter'")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSON NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS options JSON NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255)")

    # --- orders: add columns present in ORM but not in 0001/0005 ---
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(50) NOT NULL DEFAULT ''")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DOUBLE PRECISION NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax DOUBLE PRECISION NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping DOUBLE PRECISION NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD'")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSON NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address JSON NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS options JSON")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS customer_email")

    # --- order_items: add columns present in ORM but not in 0001 ---
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255) NOT NULL DEFAULT ''")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name VARCHAR(255)")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NOT NULL DEFAULT ''")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price DOUBLE PRECISION NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION NOT NULL DEFAULT 0")

    # --- customers: add refunded_total (present in ORM, matches migration 0005) ---
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS refunded_total INTEGER NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE customers DROP COLUMN IF EXISTS refunded_total")

    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS discount")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS total_price")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS sku")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS variant_name")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS product_name")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS variant_id")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS updated_at")
    op.execute("ALTER TABLE order_items DROP COLUMN IF EXISTS created_at")

    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255)")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS options")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS notes")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS billing_address")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS shipping_address")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS currency")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS discount")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS shipping")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS tax")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS subtotal")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS payment_intent_id")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS payment_method")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS order_number")

    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS subscription_id")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS trial_ends_at")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS options")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS settings")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS plan")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS domain")
