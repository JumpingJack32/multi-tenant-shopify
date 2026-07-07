"""add customers and customer_addresses tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000'")

    op.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            email VARCHAR(255) NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            phone VARCHAR(50),
            is_verified BOOLEAN NOT NULL DEFAULT false,
            total_orders INTEGER NOT NULL DEFAULT 0,
            total_spent BIGINT NOT NULL DEFAULT 0,
            refunded_total BIGINT NOT NULL DEFAULT 0,
            last_order_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_customers_tenant_email
        ON customers (tenant_id, email)
    """)
    op.execute("ALTER TABLE customers ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_customers ON customers
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    # Add customer_id and payment_status to orders (columns used by trigger/FK)
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id UUID")
    op.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NOT NULL DEFAULT 'pending'")
    op.execute("""
        ALTER TABLE orders
        ADD CONSTRAINT fk_orders_customer
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_addresses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            address_type VARCHAR(50) NOT NULL DEFAULT 'shipping',
            line1 VARCHAR(255) NOT NULL,
            line2 VARCHAR(255),
            city VARCHAR(100) NOT NULL,
            province VARCHAR(100),
            postal_code VARCHAR(20) NOT NULL,
            country VARCHAR(100) NOT NULL,
            is_default BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_default_address
        ON customer_addresses (customer_id, address_type) WHERE is_default = true
    """)
    op.execute("ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation_customer_addresses ON customer_addresses
        AS PERMISSIVE FOR ALL
        TO public
        USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
    """)

    # Trigger function to keep customers.total_orders/spent/refunded in sync
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_customer_agg()
        RETURNS TRIGGER AS $$
        DECLARE
          agg RECORD;
        BEGIN
          IF TG_OP = 'INSERT' AND NEW.payment_status IN ('PAID', 'REFUNDED') THEN
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
            INTO agg
            FROM orders
            WHERE customer_id = NEW.customer_id AND tenant_id = NEW.tenant_id;

            UPDATE customers
            SET total_orders = agg.cnt,
                total_spent = agg.paid,
                refunded_total = agg.refunded,
                last_order_at = GREATEST(last_order_at, NEW.created_at)
            WHERE id = NEW.customer_id;
          ELSIF TG_OP = 'UPDATE' THEN
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
            INTO agg
            FROM orders
            WHERE customer_id = NEW.customer_id AND tenant_id = NEW.tenant_id;

            UPDATE customers
            SET total_orders = agg.cnt,
                total_spent = agg.paid,
                refunded_total = agg.refunded,
                last_order_at = GREATEST(last_order_at, NEW.created_at)
            WHERE id = NEW.customer_id;
          ELSIF TG_OP = 'DELETE' THEN
            SELECT
              COUNT(*) FILTER (WHERE payment_status = 'PAID') AS cnt,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'PAID'), 0)::BIGINT AS paid,
              COALESCE(SUM(total) FILTER (WHERE payment_status = 'REFUNDED'), 0)::BIGINT AS refunded
            INTO agg
            FROM orders
            WHERE customer_id = OLD.customer_id AND tenant_id = OLD.tenant_id;

            UPDATE customers
            SET total_orders = agg.cnt,
                total_spent = agg.paid,
                refunded_total = agg.refunded
            WHERE id = OLD.customer_id;
          END IF;
          RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_sync_customer_agg
        AFTER INSERT OR UPDATE OF payment_status, total OR DELETE
        ON orders
        FOR EACH ROW
        EXECUTE FUNCTION sync_customer_agg()
    """)

    op.execute("RESET app.current_tenant_id")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_sync_customer_agg ON orders")
    op.execute("DROP FUNCTION IF EXISTS sync_customer_agg")
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_orders_customer")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS payment_status")
    op.execute("ALTER TABLE orders DROP COLUMN IF EXISTS customer_id")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_customer_addresses ON customer_addresses")
    op.execute("ALTER TABLE customer_addresses DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS uq_customer_default_address")
    op.execute("DROP TABLE IF EXISTS customer_addresses")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_customers ON customers")
    op.execute("ALTER TABLE customers DISABLE ROW LEVEL SECURITY")
    op.execute("DROP INDEX IF EXISTS ix_customers_tenant_email")
    op.execute("DROP TABLE IF EXISTS customers")
