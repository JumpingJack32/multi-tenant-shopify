"""add multi-warehouse inventory models

Revision ID: 18cddd76f348
Revises: 03684cb91a9e
Create Date: 2026-07-25 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f348"
down_revision: Union[str, None] = "03684cb91a9e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "inventory_nodes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("address", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_nodes_tenant_id", "inventory_nodes", ["tenant_id"], unique=False)

    op.create_table(
        "inventory_stocks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("node_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["node_id"], ["inventory_nodes.id"]),
        sa.ForeignKeyConstraint(["variant_id"], ["variants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("variant_id", "node_id", name="uq_variant_node"),
    )
    op.create_index("ix_inventory_stocks_variant_id", "inventory_stocks", ["variant_id"], unique=False)
    op.create_index("ix_inventory_stocks_node", "inventory_stocks", ["node_id"], unique=False)

    op.create_table(
        "inventory_transfers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("from_node_id", sa.Uuid(), nullable=False),
        sa.Column("to_node_id", sa.Uuid(), nullable=False),
        sa.Column("variant_id", sa.Uuid(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["from_node_id"], ["inventory_nodes.id"]),
        sa.ForeignKeyConstraint(["to_node_id"], ["inventory_nodes.id"]),
        sa.ForeignKeyConstraint(["variant_id"], ["variants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_inventory_transfers_variant_id", "inventory_transfers", ["variant_id"], unique=False)
    op.create_index("ix_inventory_transfers_from", "inventory_transfers", ["from_node_id"], unique=False)
    op.create_index("ix_inventory_transfers_to", "inventory_transfers", ["to_node_id"], unique=False)

    # Seed default Main Warehouse for each tenant and backfill stock
    op.execute("""
        INSERT INTO inventory_nodes (id, tenant_id, name, type, is_active, priority, address, created_at, updated_at)
        SELECT gen_random_uuid(), tenant_id, 'Main Warehouse', 'warehouse', true, 0, '{}'::jsonb, NOW(), NOW()
        FROM tenants
    """)
    op.execute("""
        INSERT INTO inventory_stocks (id, tenant_id, variant_id, node_id, quantity, reserved, created_at, updated_at)
        SELECT gen_random_uuid(), v.tenant_id, v.id, n.id, v.inventory_quantity, 0, NOW(), NOW()
        FROM variants v
        JOIN inventory_nodes n ON n.tenant_id = v.tenant_id AND n.type = 'warehouse' AND n.name = 'Main Warehouse'
        WHERE v.inventory_quantity > 0
    """)


def downgrade() -> None:
    op.drop_table("inventory_transfers")
    op.drop_table("inventory_stocks")
    op.drop_table("inventory_nodes")
