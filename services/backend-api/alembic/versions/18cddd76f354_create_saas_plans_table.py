"""create saas_plans table for platform billing tiers

Revision ID: 18cddd76f354
Revises: 18cddd76f353
Create Date: 2026-07-28 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f354"
down_revision: Union[str, None] = "18cddd76f353"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "saas_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("price_cents_monthly", sa.Integer(), nullable=False),
        sa.Column("price_cents_yearly", sa.Integer(), nullable=False),
        sa.Column("trial_days", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("features", sa.JSON(), nullable=False),
        sa.Column("stripe_price_id_monthly", sa.String(length=255), nullable=True),
        sa.Column("stripe_price_id_yearly", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saas_plans_slug", "saas_plans", ["slug"], unique=True)
    op.create_index("ix_saas_plans_tenant_id", "saas_plans", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_table("saas_plans")
