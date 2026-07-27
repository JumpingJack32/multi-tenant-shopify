"""add full-text search vector to products

Revision ID: 18cddd76f352
Revises: 18cddd76f351
Create Date: 2026-07-27 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "18cddd76f352"
down_revision: Union[str, None] = "18cddd76f351"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_search ON products USING GIN(search_vector)
    """)
    op.execute("""
        CREATE OR REPLACE FUNCTION products_search_vector_trigger() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''));
            RETURN NEW;
        END
        $$ LANGUAGE plpgsql
    """)
    op.execute("""
        DROP TRIGGER IF EXISTS tsvector_update ON products
    """)
    op.execute("""
        CREATE TRIGGER tsvector_update
        BEFORE INSERT OR UPDATE OF name, description ON products
        FOR EACH ROW EXECUTE FUNCTION products_search_vector_trigger()
    """)
    op.execute("""
        UPDATE products SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tsvector_update ON products")
    op.execute("DROP FUNCTION IF EXISTS products_search_vector_trigger")
    op.execute("DROP INDEX IF EXISTS ix_products_search")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS search_vector")
