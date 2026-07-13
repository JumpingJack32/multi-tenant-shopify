"""add purchase order system (suppliers, POs, fulfillment links)

Creates suppliers, purchase_orders, purchase_order_items, order_fulfillment_links tables.
Backfills supplier data from product.supplier free-text column.
Drops product.supplier, adds supplier_id FK, adds variant fields.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create suppliers table
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_email", sa.String(length=255), nullable=True),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("delivery_method", sa.String(length=50), nullable=False, server_default="manual_email"),
        sa.PrimaryKeyConstraint("id"),
    )

    # 2. Add variant columns before data migration
    with op.batch_alter_table("variants", schema=None) as batch_op:
        batch_op.add_column(sa.Column("supplier_sku", sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column("cost_price", sa.Integer(), nullable=True))

    # 3. Backfill: extract unique supplier names into suppliers table
    op.execute("""
        INSERT INTO suppliers (id, tenant_id, name, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            p.tenant_id,
            p.supplier,
            NOW(),
            NOW()
        FROM (SELECT DISTINCT tenant_id, supplier FROM products WHERE supplier IS NOT NULL AND supplier != '') p
        WHERE NOT EXISTS (
            SELECT 1 FROM suppliers s
            WHERE s.tenant_id = p.tenant_id AND s.name = p.supplier
        )
    """)

    # 4. Add supplier_id to products (nullable first, then populate)
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.add_column(sa.Column("supplier_id", sa.Uuid(), nullable=True))

    op.execute("""
        UPDATE products p
        SET supplier_id = s.id
        FROM suppliers s
        WHERE s.tenant_id = p.tenant_id AND s.name = p.supplier
    """)

    # 5. Drop old supplier text column
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.drop_column("supplier")

    # 6. Add FK constraint on supplier_id
    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.create_foreign_key(
            "fk_products_supplier_id",
            "suppliers",
            ["supplier_id"],
            ["id"],
            ondelete="RESTRICT",
        )

    # 7. Create po_sequences table (thread-safe PO numbering)
    op.create_table(
        "po_sequences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("date_prefix", sa.String(length=8), nullable=False),
        sa.Column("counter", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "date_prefix", name="uq_po_sequences_tenant_date"),
    )

    # 8. Create purchase_orders table
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("po_number", sa.String(length=50), nullable=False),
        sa.Column("supplier_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="pending_review"),
        sa.Column("fulfillment_strategy", sa.String(length=50), nullable=False, server_default="dropship"),
        sa.Column("ship_to_address_id", sa.Uuid(), nullable=True),
        sa.Column("ship_to_address_snapshot", sa.JSON(), nullable=True),
        sa.Column("tracking_number", sa.String(length=255), nullable=True),
        sa.Column("carrier", sa.String(length=100), nullable=True),
        sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tax", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("shipping_cost", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["supplier_id"], ["suppliers.id"], ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 8. Create purchase_order_items table
    op.create_table(
        "purchase_order_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("purchase_order_id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("supplier_sku", sa.String(length=255), nullable=True),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("variant_label", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Integer(), nullable=False),
        sa.Column("subtotal", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("received_quantity", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["purchase_order_id"], ["purchase_orders.id"], ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["variant_id"], ["variants.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 9. Create order_fulfillment_links table
    op.create_table(
        "order_fulfillment_links",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("order_item_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("purchase_order_item_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_item_id"], ["order_items.id"],
        ),
        sa.ForeignKeyConstraint(
            ["purchase_order_item_id"], ["purchase_order_items.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("order_fulfillment_links")
    op.drop_table("purchase_order_items")
    op.drop_table("purchase_orders")
    op.drop_table("po_sequences")

    with op.batch_alter_table("products", schema=None) as batch_op:
        batch_op.drop_constraint("fk_products_supplier_id", type_="foreignkey")
        batch_op.drop_column("supplier_id")
        batch_op.add_column(sa.Column("supplier", sa.String(length=255), nullable=True))

    with op.batch_alter_table("variants", schema=None) as batch_op:
        batch_op.drop_column("cost_price")
        batch_op.drop_column("supplier_sku")

    op.drop_table("suppliers")
