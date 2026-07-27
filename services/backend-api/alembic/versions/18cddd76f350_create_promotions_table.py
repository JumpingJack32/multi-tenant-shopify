"""create promotions table

Revision ID: 18cddd76f350
Revises: 18cddd76f348
Create Date: 2026-07-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f350"
down_revision: Union[str, None] = "18cddd76f349"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promotions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("min_subtotal", sa.Integer(), nullable=True),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("uses_count", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "code", name="uq_promotion_tenant_code"),
    )
    op.create_index("ix_promotions_tenant_id", "promotions", ["tenant_id"], unique=False)
    op.create_index("ix_promotions_code", "promotions", ["code"], unique=False)


def downgrade() -> None:
    op.drop_table("promotions")
