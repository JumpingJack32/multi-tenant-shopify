"""create subscription plans and customer subscriptions tables

Revision ID: 18cddd76f353
Revises: 18cddd76f352
Create Date: 2026-07-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f353"
down_revision: Union[str, None] = "18cddd76f352"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("interval", sa.String(length=20), nullable=False),
        sa.Column("interval_count", sa.Integer(), nullable=False),
        sa.Column("discount_percentage", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscription_plans_tenant_id", "subscription_plans", ["tenant_id"], unique=False)
    op.create_index("ix_subscription_plans_product_id", "subscription_plans", ["product_id"], unique=False)

    op.create_table(
        "customer_subscriptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("customer_email", sa.String(length=320), nullable=False),
        sa.Column("subscription_plan_id", sa.Uuid(), nullable=False),
        sa.Column("stripe_subscription_id", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_customer_subscriptions_tenant_id", "customer_subscriptions", ["tenant_id"], unique=False)
    op.create_index("ix_customer_subscriptions_email", "customer_subscriptions", ["customer_email"], unique=False)
    op.create_index("ix_customer_subscriptions_stripe_id", "customer_subscriptions", ["stripe_subscription_id"], unique=False)


def downgrade() -> None:
    op.drop_table("customer_subscriptions")
    op.drop_table("subscription_plans")
