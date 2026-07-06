"""add product_images, variants, inventory, locations; update products

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    # -- product_images ----------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS product_images (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            url VARCHAR(2048) NOT NULL,
            alt_text VARCHAR(500),
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_product_images_product
        ON product_images (product_id)
    """)

    # -- variants ----------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS variants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            sku VARCHAR(100) NOT NULL,
            barcode VARCHAR(255),
            price NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
            compare_at_price NUMERIC(10, 2) CHECK (compare_at_price >= 0),
            weight DOUBLE PRECISION,
            weight_unit VARCHAR(10) NOT NULL DEFAULT 'kg',
            inventory_quantity INTEGER NOT NULL DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            options JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_variants_tenant_sku
        ON variants (tenant_id, sku)
    """)

    # -- locations ---------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            city VARCHAR(100),
            country VARCHAR(100),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)

    # -- inventory ---------------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID,
            variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
            location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
            quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
            reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
            reorder_level INTEGER NOT NULL DEFAULT 0,
            reorder_quantity INTEGER NOT NULL DEFAULT 50,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_tenant_variant
        ON inventory (tenant_id, variant_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_inventory_tenant_location
        ON inventory (tenant_id, location_id)
    """)

    # -- Update products table ---------------------------------------------
    # Add columns that don't exist yet (idempotent via IF NOT EXISTS or DO block)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='slug') THEN
                ALTER TABLE products ADD COLUMN slug VARCHAR(255);
                CREATE INDEX IF NOT EXISTS ix_products_slug ON products (slug);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weight') THEN
                ALTER TABLE products ADD COLUMN weight DOUBLE PRECISION;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='weight_unit') THEN
                ALTER TABLE products ADD COLUMN weight_unit VARCHAR(10) NOT NULL DEFAULT 'kg';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
                ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price') THEN
                -- Check if old integer price column exists
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='price' AND data_type='integer') THEN
                    ALTER TABLE products ADD COLUMN price_numeric NUMERIC(10, 2);
                    UPDATE products SET price_numeric = price::NUMERIC / 100.0;
                    ALTER TABLE products DROP COLUMN price;
                    ALTER TABLE products RENAME COLUMN price_numeric TO price;
                    ALTER TABLE products ALTER COLUMN price SET NOT NULL;
                    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
                ELSE
                    ALTER TABLE products ADD COLUMN price NUMERIC(10, 2) NOT NULL DEFAULT 0;
                    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
                END IF;
            END IF;
        END $$;
    """)

    # Add composite index for tenant+slug lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_products_tenant_slug
        ON products (tenant_id, slug)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS inventory")
    op.execute("DROP TABLE IF EXISTS locations")
    op.execute("DROP TABLE IF EXISTS variants")
    op.execute("DROP TABLE IF EXISTS product_images")
    # Note: products table alterations are NOT reverted in downgrade
    # to avoid data loss. Full rollback requires a restore.
