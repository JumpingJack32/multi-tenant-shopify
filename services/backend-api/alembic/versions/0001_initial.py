"""empty message

Revision ID: 0001
Revises: 
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID UNIQUE NOT NULL,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON tenants
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_tenants_tenant_id ON tenants(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL CHECK (price >= 0),
            sku TEXT,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("ALTER TABLE products ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON products
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            customer_email TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
            total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("ALTER TABLE orders ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON orders
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            product_id UUID NOT NULL,
            tenant_id UUID NOT NULL,
            quantity INTEGER NOT NULL CHECK (quantity > 0),
            unit_price INTEGER NOT NULL CHECK (unit_price >= 0)
        )
    """)
    op.execute("ALTER TABLE order_items ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON order_items
            USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_order_items_tenant_id ON order_items(tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS order_items")
    op.execute("DROP TABLE IF EXISTS orders")
    op.execute("DROP TABLE IF EXISTS products")
    op.execute("DROP TABLE IF EXISTS tenants")
