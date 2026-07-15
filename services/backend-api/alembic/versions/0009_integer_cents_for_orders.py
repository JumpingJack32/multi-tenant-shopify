"""convert order financial columns to integer cents

Ensures orders.total, subtotal, tax, shipping, discount and
order_items.unit_price, total_price, discount are stored as INTEGER cents,
matching the project's integer-cents design pattern (same as purchase_orders).

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-10
"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- orders: float → integer cents ---
    op.execute("""
        UPDATE orders SET
            subtotal = ROUND(subtotal * 100),
            tax = ROUND(tax * 100),
            shipping = ROUND(shipping * 100),
            discount = ROUND(discount * 100),
            total = ROUND(total * 100)
        WHERE subtotal IS NOT NULL
    """)

    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.alter_column("subtotal", type_=sa.Integer(), postgresql_using="subtotal::integer")
        batch_op.alter_column("tax", type_=sa.Integer(), postgresql_using="tax::integer")
        batch_op.alter_column("shipping", type_=sa.Integer(), postgresql_using="shipping::integer")
        batch_op.alter_column("discount", type_=sa.Integer(), postgresql_using="discount::integer")
        batch_op.alter_column("total", type_=sa.Integer(), postgresql_using="total::integer")

    # --- order_items: float → integer cents ---
    op.execute("""
        UPDATE order_items SET
            unit_price = ROUND(unit_price * 100),
            total_price = ROUND(total_price * 100),
            discount = ROUND(discount * 100)
        WHERE unit_price IS NOT NULL
    """)

    with op.batch_alter_table("order_items", schema=None) as batch_op:
        batch_op.alter_column("unit_price", type_=sa.Integer(), postgresql_using="unit_price::integer")
        batch_op.alter_column("total_price", type_=sa.Integer(), postgresql_using="total_price::integer")
        batch_op.alter_column("discount", type_=sa.Integer(), postgresql_using="discount::integer")

    # --- customer totals are already BIGINT cents — just ensure consistency ---
    # Customer.total_spent is BIGINT already — but seed had rounding issues
    op.execute("""
        UPDATE customers SET
            total_spent = (SELECT COALESCE(ROUND(SUM(total)::numeric / 100.0 * 100), 0)::BIGINT FROM orders WHERE customer_id = customers.id),
            total_orders = (SELECT count(*) FROM orders WHERE customer_id = customers.id)
    """)


def downgrade() -> None:
    with op.batch_alter_table("order_items", schema=None) as batch_op:
        batch_op.alter_column("discount", type_=sa.Float(), postgresql_using="discount::double precision")
        batch_op.alter_column("total_price", type_=sa.Float(), postgresql_using="total_price::double precision")
        batch_op.alter_column("unit_price", type_=sa.Float(), postgresql_using="unit_price::double precision")

    op.execute("""
        UPDATE order_items SET
            unit_price = unit_price / 100.0,
            total_price = total_price / 100.0,
            discount = discount / 100.0
    """)

    with op.batch_alter_table("orders", schema=None) as batch_op:
        batch_op.alter_column("total", type_=sa.Float(), postgresql_using="total::double precision")
        batch_op.alter_column("discount", type_=sa.Float(), postgresql_using="discount::double precision")
        batch_op.alter_column("shipping", type_=sa.Float(), postgresql_using="shipping::double precision")
        batch_op.alter_column("tax", type_=sa.Float(), postgresql_using="tax::double precision")
        batch_op.alter_column("subtotal", type_=sa.Float(), postgresql_using="subtotal::double precision")

    op.execute("""
        UPDATE orders SET
            subtotal = subtotal / 100.0,
            tax = tax / 100.0,
            shipping = shipping / 100.0,
            discount = discount / 100.0,
            total = total / 100.0
    """)
