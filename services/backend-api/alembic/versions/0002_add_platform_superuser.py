"""add platform superuser flag and missing tables

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create clerk_webhook_events table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS clerk_webhook_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id TEXT UNIQUE NOT NULL,
            event_type TEXT NOT NULL,
            data JSONB NOT NULL DEFAULT '{}',
            processed BOOLEAN NOT NULL DEFAULT false,
            processed_at TIMESTAMPTZ,
            tenant_id UUID,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_clerk_webhook_events_event_id ON clerk_webhook_events(event_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_clerk_webhook_events_processed ON clerk_webhook_events(processed)")

    # Create tenant_users table if it doesn't exist (with is_platform_superuser)
    op.execute("""
        CREATE TABLE IF NOT EXISTS tenant_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            clerk_user_id TEXT NOT NULL DEFAULT '',
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            is_active BOOLEAN NOT NULL DEFAULT true,
            is_platform_superuser BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_clerk_id ON tenant_users(tenant_id, clerk_user_id)")
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_users_tenant_clerk_id 
        ON tenant_users(tenant_id, clerk_user_id)
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE tenant_users DROP COLUMN IF EXISTS is_platform_superuser")
    op.execute("DROP TABLE IF EXISTS clerk_webhook_events")
