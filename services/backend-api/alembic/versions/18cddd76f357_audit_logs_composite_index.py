"""add composite index to audit_logs for filtered paginated lookups

Revision ID: 18cddd76f357
Revises: 18cddd76f356
Create Date: 2026-08-08 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "18cddd76f357"
down_revision: Union[str, None] = "18cddd76f356"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_audit_logs_tenant_created_idx")
