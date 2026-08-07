"""add rbac fields to tenant_users and create audit_logs

Revision ID: 18cddd76f355
Revises: 18cddd76f354
Create Date: 2026-08-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f355"
down_revision: Union[str, None] = "18cddd76f354"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # TenantUser RBAC fields (raw ALTER TABLE — op.add_column is unreliable)
    op.execute(
        "ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'"
    )
    op.execute("ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS invited_by UUID")
    op.execute("ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ")
    op.execute("ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ")

    # Audit log table for high-risk permission actions
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=True),
        sa.Column("resource_id", sa.String(length=100), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_audit_logs_tenant_created",
        "audit_logs",
        ["tenant_id", sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS last_login_at")
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS invited_at")
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS invited_by")
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS status")
