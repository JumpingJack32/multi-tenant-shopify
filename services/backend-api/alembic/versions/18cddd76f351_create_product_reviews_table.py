"""create product_reviews table and add rating columns to products

Revision ID: 18cddd76f351
Revises: 18cddd76f350
Create Date: 2026-07-27 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f351"
down_revision: Union[str, None] = "18cddd76f350"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_reviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("product_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("body", sa.String(length=5000), nullable=False),
        sa.Column("reviewer_name", sa.String(length=100), nullable=False),
        sa.Column("is_verified_buyer", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("helpful_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_reviews_tenant_id", "product_reviews", ["tenant_id"], unique=False)
    op.create_index("ix_product_reviews_product_id", "product_reviews", ["product_id"], unique=False)
    op.create_index("ix_reviews_product_status", "product_reviews", ["product_id", "status"], unique=False)

    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS avg_rating INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.drop_table("product_reviews")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS review_count")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS avg_rating")
