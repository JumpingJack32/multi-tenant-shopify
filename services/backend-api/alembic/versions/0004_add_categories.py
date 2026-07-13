"""add categories table and category_id to products

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) NOT NULL,
            description TEXT,
            image_url VARCHAR(2048),
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ix_categories_tenant_slug
        ON categories (tenant_id, slug)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_categories_tenant_active
        ON categories (tenant_id, is_active)
    """)
    op.execute("""
        ALTER TABLE categories ENABLE ROW LEVEL SECURITY
    """)
    op.execute("""
        CREATE POLICY tenant_isolation_categories ON categories
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("""
        ALTER TABLE products
        ADD COLUMN category_id UUID
        REFERENCES categories(id) ON DELETE SET NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_category
        ON products (tenant_id, category_id)
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_products_category")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS category_id")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_categories ON categories")
    op.execute("ALTER TABLE categories DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_categories_tenant_active")
    op.execute("DROP INDEX IF EXISTS ix_categories_tenant_slug")
    op.execute("DROP TABLE IF EXISTS categories")
