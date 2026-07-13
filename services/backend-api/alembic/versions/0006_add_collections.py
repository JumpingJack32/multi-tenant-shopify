"""add collections and product_collections tables

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS collections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            hero_image_url VARCHAR(2048),
            hero_image_alt VARCHAR(500),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_collections_tenant_slug
        ON collections (tenant_id, slug)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_collections_tenant_active
        ON collections (tenant_id, is_active)
    """)
    op.execute("ALTER TABLE collections ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_collections ON collections
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS product_collections (
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (product_id, collection_id)
        )
    """)
    op.execute("ALTER TABLE product_collections ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_product_collections ON product_collections
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_product_collections ON product_collections")
    op.execute("ALTER TABLE product_collections DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS product_collections")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_collections ON collections")
    op.execute("ALTER TABLE collections DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_collections_tenant_active")
    op.execute("DROP INDEX IF EXISTS ix_collections_tenant_slug")
    op.execute("DROP TABLE IF EXISTS collections")
