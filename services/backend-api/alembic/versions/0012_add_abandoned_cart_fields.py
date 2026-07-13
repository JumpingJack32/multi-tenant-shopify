"""add abandoned cart tracking fields to carts

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carts", sa.Column("email", sa.String(320), nullable=True))
    op.execute("CREATE TYPE cartstatus AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED')")
    op.add_column(
        "carts",
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "COMPLETED", "ABANDONED", name="cartstatus", create_type=False),
            nullable=False,
            server_default="ACTIVE",
        ),
    )
    op.add_column(
        "carts",
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "carts",
        sa.Column("unsubscribed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "carts",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_carts_abandoned_worker",
        "carts",
        ["status", "unsubscribed", "email", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_carts_abandoned_worker", table_name="carts")
    op.drop_column("carts", "completed_at")
    op.drop_column("carts", "unsubscribed")
    op.drop_column("carts", "last_reminded_at")
    op.drop_column("carts", "status")
    op.drop_column("carts", "email")
    op.execute("DROP TYPE IF EXISTS cartstatus")
