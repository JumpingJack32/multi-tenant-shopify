"""Database seed script for multi-tenant shopify platform."""

import asyncio
import asyncpg
import os
import uuid

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")

# Strip asyncpg dialect prefix - asyncpg expects standard postgresql:// DSN
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


async def seed_database():
    conn = await asyncpg.connect(DATABASE_URL)

    try:
        # Get tenants by slug (create if missing)
        tenants = await conn.fetch(
            "SELECT id, tenant_id, slug FROM tenants WHERE slug = $1 OR slug = $2 OR slug = $3",
            "acme-corp", "globex-inc", "initech",
        )
        tenants_by_slug = {t["slug"]: t for t in tenants}

        # Create any missing tenants
        missing_tenants = []
        for slug in ["acme-corp", "globex-inc", "initech"]:
            if slug not in tenants_by_slug:
                tid = uuid.uuid4()
                await conn.execute(
                    """INSERT INTO tenants (id, tenant_id, name, slug, plan, status, settings, options, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                       ON CONFLICT (slug) DO NOTHING""",
                    tid, tid, slug.replace("-", " ").title(), slug, "starter", "ACTIVE", "{}", "{}",
                )
                missing_tenants.append((slug, tid))

        # Refresh tenant list
        tenants = await conn.fetch(
            "SELECT id, tenant_id, slug FROM tenants WHERE slug = $1 OR slug = $2 OR slug = $3",
            "acme-corp", "globex-inc", "initech",
        )
        tenants_by_slug = {t["slug"]: t for t in tenants}

        if len(tenants) < 3:
            print(f"Warning: Expected 3 tenants, found {len(tenants)}")
            return

        acme = tenants_by_slug["acme-corp"]
        globex = tenants_by_slug["globex-inc"]
        initech = tenants_by_slug["initech"]

        # Create customers for each tenant
        customers_t1 = []
        for i, (first, last, email) in enumerate([
            ("John", "Doe", "john@acme.com"),
            ("Jane", "Smith", "jane@acme.com"),
        ]):
            cid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NULL, true, 0, 0.00, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                cid, acme["tenant_id"], email, first, last,
            )
            customers_t1.append(cid)

        customers_t2 = []
        for i, (first, last, email) in enumerate([
            ("Marty", "McFly", "marty@delorean.com"),
            ("Doc", "Brown", "doc@future.com"),
        ]):
            cid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NULL, true, 0, 0.00, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                cid, globex["tenant_id"], email, first, last,
            )
            customers_t2.append(cid)

        customers_t3 = []
        for i, (first, last, email) in enumerate([
            ("Peter", "Gibbons", "peter@initech.com"),
            ("Milton", "Waddams", "milton@initech.com"),
        ]):
            cid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, NULL, true, 0, 0.00, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                cid, initech["tenant_id"], email, first, last,
            )
            customers_t3.append(cid)

        # Create products for acme-corp
        products_t1 = []
        product_data_t1 = [
            ("Rocket Skates", "Classic rocket-powered skates", "RSK-001", 299.99),
            ("Laser Watch", "Watch with built-in laser", "LWS-002", 149.99),
            ("Tornado Machine", "Personal weather control device", "TWM-003", 499.99),
            ("Shrink Ray", "Portable size-reduction device", "SRY-004", 199.99),
            ("Teleporter", "Instant transportation device", "TLP-005", 999.99),
        ]
        for name, desc, sku, price in product_data_t1:
            pid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO products (id, tenant_id, name, slug, description, status, sku, weight_unit, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'PUBLISHED', $6, 'kg', true, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                pid, acme["tenant_id"], name, f"{name.lower().replace(' ', '-')}", desc, sku,
            )
            # Create variant with price
            vid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, options, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'kg', 100, true, '{}'::json, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                vid, acme["tenant_id"], pid, f"{sku}-VAR", price,
            )
            # Insert product_images with Cloudinary public IDs
            cloudinary_prefix = "demo/products"
            image_names = ["hero", "detail-1", "detail-2"]
            for sort_order, suffix in enumerate(image_names):
                iid = uuid.uuid4()
                public_id = f"{cloudinary_prefix}/{name.lower().replace(' ', '-')}-{suffix}"
                await conn.execute(
                    """INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    iid, acme["tenant_id"], pid, public_id, f"{name} - {suffix.replace('-', ' ').title()}", sort_order,
                )
            # Set product price from variant price
            await conn.execute(
                "UPDATE products SET price = $1 WHERE id = $2 AND price IS NULL",
                price, pid,
            )
            products_t1.append((pid, vid))

        # Create products for globex-inc
        products_t2 = []
        product_data_t2 = [
            ("DeLorean Time Machine", "Go back to the future", "DTM-001", 1499.99),
            ("Plutonium Core", "Power source for time machines", "PLT-002", 750.00),
            ("Flux Capacitor", "1.21 gigawatts required", "FLX-003", 599.99),
            ("Hoverboard", "Anti-gravity personal transport", "HVB-004", 399.99),
        ]
        for name, desc, sku, price in product_data_t2:
            pid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO products (id, tenant_id, name, slug, description, status, sku, weight_unit, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'PUBLISHED', $6, 'kg', true, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                pid, globex["tenant_id"], name, f"{name.lower().replace(' ', '-')}", desc, sku,
            )
            vid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, options, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'kg', 50, true, '{}'::json, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                vid, globex["tenant_id"], pid, f"{sku}-VAR", price,
            )
            # Insert product_images with Cloudinary public IDs
            cloudinary_prefix = "demo/products"
            image_names = ["hero", "detail-1", "detail-2"]
            for sort_order, suffix in enumerate(image_names):
                iid = uuid.uuid4()
                public_id = f"{cloudinary_prefix}/{name.lower().replace(' ', '-')}-{suffix}"
                await conn.execute(
                    """INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    iid, globex["tenant_id"], pid, public_id, f"{name} - {suffix.replace('-', ' ').title()}", sort_order,
                )
            # Set product price from variant price
            await conn.execute(
                "UPDATE products SET price = $1 WHERE id = $2 AND price IS NULL",
                price, pid,
            )
            products_t2.append((pid, vid))

        # Create products for initech
        products_t3 = []
        product_data_t3 = [
            ("TPS Report Generator", "Automate your paper pushing", "TPS-001", 9.99),
            ("Staple Remover Pro", "Professional-grade staple removal", "SRP-002", 4.99),
            ("Meeting Scheduler", "Schedule unnecessary meetings", "MTS-003", 0.00),
        ]
        for name, desc, sku, price in product_data_t3:
            pid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO products (id, tenant_id, name, slug, description, status, sku, weight_unit, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'PUBLISHED', $6, 'kg', true, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                pid, initech["tenant_id"], name, f"{name.lower().replace(' ', '-')}", desc, sku,
            )
            vid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, options, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'kg', 999, true, '{}'::json, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                vid, initech["tenant_id"], pid, f"{sku}-VAR", price,
            )
            # Insert product_images with Cloudinary public IDs
            cloudinary_prefix = "demo/products"
            image_names = ["hero", "detail-1", "detail-2"]
            for sort_order, suffix in enumerate(image_names):
                iid = uuid.uuid4()
                public_id = f"{cloudinary_prefix}/{name.lower().replace(' ', '-')}-{suffix}"
                await conn.execute(
                    """INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    iid, initech["tenant_id"], pid, public_id, f"{name} - {suffix.replace('-', ' ').title()}", sort_order,
                )
            # Set product price from variant price
            await conn.execute(
                "UPDATE products SET price = $1 WHERE id = $2 AND price IS NULL",
                price, pid,
            )
            products_t3.append((pid, vid))

        # Create orders for acme-corp
        order1_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'CONFIRMED', 'PAID', 449.98, 36.00, 15.00, 500.98, 'usd', NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            order1_id, acme["tenant_id"], "ORD-001", customers_t1[0],
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), acme["tenant_id"], order1_id, products_t1[0][1], products_t1[0][0],
            "Rocket Skates", "Rocket Skates VAR", "RSK-001-VAR", 1, 299.99, 299.99,
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), acme["tenant_id"], order1_id, products_t1[1][1], products_t1[1][0],
            "Laser Watch", "Laser Watch VAR", "LWS-002-VAR", 1, 149.99, 149.99,
        )

        order2_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'PENDING', 'PENDING', 999.99, 80.00, 25.00, 1104.99, 'usd', NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            order2_id, acme["tenant_id"], "ORD-002", customers_t1[1],
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), acme["tenant_id"], order2_id, products_t1[4][1], products_t1[4][0],
            "Teleporter", "Teleporter VAR", "TLP-005-VAR", 1, 999.99, 999.99,
        )

        # Create orders for globex-inc
        order3_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'SHIPPED', 'PAID', 2099.98, 168.00, 35.00, 2302.98, 'usd', NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            order3_id, globex["tenant_id"], "ORD-003", customers_t2[0],
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), globex["tenant_id"], order3_id, products_t2[0][1], products_t2[0][0],
            "DeLorean Time Machine", "DeLorean Time Machine VAR", "DTM-001-VAR", 1, 1499.99, 1499.99,
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), globex["tenant_id"], order3_id, products_t2[2][1], products_t2[2][0],
            "Flux Capacitor", "Flux Capacitor VAR", "FLX-003-VAR", 1, 599.99, 599.99,
        )

        # Create orders for initech
        order4_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'DELIVERED', 'PAID', 14.98, 1.20, 5.00, 21.18, 'usd', NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            order4_id, initech["tenant_id"], "ORD-004", customers_t3[0],
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), initech["tenant_id"], order4_id, products_t3[0][1], products_t3[0][0],
            "TPS Report Generator", "TPS Report Generator VAR", "TPS-001-VAR", 1, 9.99, 9.99,
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), initech["tenant_id"], order4_id, products_t3[1][1], products_t3[1][0],
            "Staple Remover Pro", "Staple Remover Pro VAR", "SRP-002-VAR", 1, 4.99, 4.99,
        )

        order5_id = uuid.uuid4()
        await conn.execute(
            """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'CANCELLED', 'REFUNDED', 0.00, 0.00, 0.00, 0.00, 'usd', NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            order5_id, initech["tenant_id"], "ORD-005", customers_t3[1],
        )
        await conn.execute(
            """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), initech["tenant_id"], order5_id, products_t3[2][1], products_t3[2][0],
            "Meeting Scheduler", "Meeting Scheduler VAR", "MTS-003-VAR", 1, 0.00, 0.00,
        )

        await conn.commit()
        print("\nDatabase seeded successfully!")
        print(f"Total: 3 tenants, 12 products, 12 variants, 6 customers, 5 orders")
        print("Note: Existing data was preserved. Only missing records were added.")

    except Exception as e:
        print(f"Error seeding database: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
