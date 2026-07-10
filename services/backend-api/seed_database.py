"""Database seed script for multi-tenant shopify platform.

Idempotent -- truncates all tenant-scoped data, then re-seeds from scratch.
Runs inside a single transaction; any failure triggers a full rollback.
"""

import asyncio
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import text

random.seed(42)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")
if "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(DATABASE_URL)

# ── Tenant metadata ──────────────────────────────────────────────────

TENANTS = [
    {"slug": "acme-corp", "name": "Acme Corp", "plan": "starter"},
    {"slug": "globex-inc", "name": "Globex Inc", "plan": "business"},
    {"slug": "initech", "name": "Initech", "plan": "enterprise"},
]

# ── Catalog data ─────────────────────────────────────────────────────

CATEGORY_NAMES = ["Outerwear", "Footwear", "Accessories", "Bottoms", "Tops"]

COLLECTION_NAMES = ["New Arrivals", "Best Sellers", "Seasonal", "Featured"]

ACME_PRODUCTS: list[tuple[str, str, str, float, str, int]] = [
    ("Rocket Skates", "Classic rocket-powered skates", "RSK-001", 299.99, "footwear", 100),
    ("Laser Watch", "Watch with built-in laser", "LWS-002", 149.99, "accessories", 100),
    ("Tornado Machine", "Personal weather control device", "TWM-003", 499.99, "outerwear", 50),
    ("Shrink Ray", "Portable size-reduction device", "SRY-004", 199.99, "accessories", 75),
    ("Teleporter", "Instant transportation device", "TLP-005", 999.99, "accessories", 25),
]

GLOBEX_PRODUCTS: list[tuple[str, str, str, float, str, int]] = [
    ("DeLorean Time Machine", "Go back to the future", "DTM-001", 1499.99, "outerwear", 10),
    ("Plutonium Core", "Power source for time machines", "PLT-002", 750.00, "accessories", 200),
    ("Flux Capacitor", "1.21 gigawatts required", "FLX-003", 599.99, "accessories", 50),
    ("Hoverboard", "Anti-gravity personal transport", "HVB-004", 399.99, "footwear", 150),
]

INITECH_PRODUCTS: list[tuple[str, str, str, float, str, int]] = [
    ("TPS Report Generator", "Automate your paper pushing", "TPS-001", 9.99, "accessories", 999),
    ("Staple Remover Pro", "Professional-grade staple removal", "SRP-002", 4.99, "accessories", 500),
    ("Meeting Scheduler", "Schedule unnecessary meetings", "MTS-003", 0.00, "accessories", 0),
]

PRODUCTS_BY_TENANT = {
    "acme-corp": ACME_PRODUCTS,
    "globex-inc": GLOBEX_PRODUCTS,
    "initech": INITECH_PRODUCTS,
}

CATEGORY_MAP = {
    "Rocket Skates": "footwear",
    "Laser Watch": "accessories",
    "Tornado Machine": "outerwear",
    "Shrink Ray": "accessories",
    "Teleporter": "accessories",
    "DeLorean Time Machine": "outerwear",
    "Plutonium Core": "accessories",
    "Flux Capacitor": "accessories",
    "Hoverboard": "footwear",
    "TPS Report Generator": "accessories",
    "Staple Remover Pro": "accessories",
    "Meeting Scheduler": "accessories",
    "Zero Point Energy Field": "accessories",
    "Telepathic Paper": "accessories",
}

# ── Customer data ────────────────────────────────────────────────────

CUSTOMERS_BY_TENANT: dict[str, list[tuple[str, str, str]]] = {
    "acme-corp": [
        ("John", "Doe", "john@acme.com"),
        ("Jane", "Smith", "jane@acme.com"),
        ("Bugs", "Bunny", "bugs@acme.com"),
        ("Daffy", "Duck", "daffy@acme.com"),
        ("Porky", "Pig", "porky@acme.com"),
        ("Elmer", "Fudd", "elmer@acme.com"),
        ("Wile", "Coyote", "wile@acme.com"),
        ("Road", "Runner", "road@acme.com"),
    ],
    "globex-inc": [
        ("Marty", "McFly", "marty@delorean.com"),
        ("Doc", "Brown", "doc@future.com"),
        ("Jennifer", "Parker", "jennifer@future.com"),
        ("Biff", "Tannen", "biff@tannen.com"),
        ("Einstein", "Dog", "einstein@future.com"),
        ("Dr.", "Strange", "strange@marvel.com"),
        ("Ellen", "Ripley", "ripley@weyland.com"),
        ("Sarah", "Connor", "sarah@resistance.com"),
        ("John", "Connor", "john@resistance.com"),
    ],
    "initech": [
        ("Peter", "Gibbons", "peter@initech.com"),
        ("Milton", "Waddams", "milton@initech.com"),
        ("Michael", "Bolton", "michael@initech.com"),
        ("Samir", "Nagheenanajar", "samir@initech.com"),
        ("Bill", "Lumbergh", "bill@initech.com"),
        ("Bob", "Slydell", "bob@initech.com"),
        ("Nina", "Bookchin", "nina@initech.com"),
        ("Tom", "Smykowski", "tom@initech.com"),
    ],
}

# ── Address data ─────────────────────────────────────────────────────

STREETS = [
    "123 Main St", "456 Oak Ave", "789 Elm St", "321 Maple Dr",
    "654 Pine Rd", "987 Cedar Ln", "111 Birch Way", "222 Walnut Ct",
    "333 Cherry Blvd", "444 Spruce St",
]
CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"]
STATES = ["NY", "CA", "IL", "TX", "AZ"]
ZIPCODES = ["10001", "90001", "60601", "77001", "85001"]
COUNTRY = "US"

# ── Order generation ─────────────────────────────────────────────────

ORDER_STATUSES = ["CONFIRMED", "SHIPPED", "DELIVERED", "PENDING", "CANCELLED"]
ORDER_STATUS_WEIGHTS = [0.25, 0.25, 0.10, 0.20, 0.10]
REFUNDED_WEIGHT = 0.10


async def clear_data(session: AsyncSession) -> None:
    tables = [
        "order_items", "orders", "inventory", "locations",
        "product_collections", "collections", "customer_addresses",
        "customers", "product_images", "variants", "products",
        "categories", "tenant_users",
    ]
    for table in tables:
        await session.execute(text(f"DELETE FROM {table}"))


async def seed_tenants(session: AsyncSession) -> dict[str, dict]:
    result: dict[str, dict] = {}
    for t in TENANTS:
        tid = uuid.uuid4()
        row = await session.execute(
            text("""
                INSERT INTO tenants (id, tenant_id, name, slug, plan, status, settings, options, created_at, updated_at)
                VALUES (:id, :tid, :name, :slug, :plan, 'ACTIVE', '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
                ON CONFLICT (slug) DO UPDATE SET plan = EXCLUDED.plan, updated_at = NOW()
                RETURNING id, tenant_id, slug, name
            """),
            {"id": tid, "tid": tid, "name": t["name"], "slug": t["slug"], "plan": t["plan"]},
        )
        r = row.fetchone()
        result[r.slug] = {"id": str(r.id), "tenant_id": str(r.tenant_id), "slug": r.slug, "name": r.name}
    return result


async def seed_users(session: AsyncSession, tenants_by_slug: dict[str, dict]) -> None:
    for slug, tenant in tenants_by_slug.items():
        await session.execute(
            text("""
                INSERT INTO tenant_users (id, tenant_id, clerk_user_id, email, password_hash, role, is_active, is_platform_superuser, created_at, updated_at)
                VALUES (:id, :tid, :clerk_id, :email, :pw, 'admin', true, false, NOW(), NOW())
                ON CONFLICT (tenant_id, clerk_user_id) DO NOTHING
            """),
            {
                "id": uuid.uuid4(),
                "tid": uuid.UUID(tenant["tenant_id"]),
                "clerk_id": f"clerk_{slug}_admin",
                "email": f"admin@{slug}.com",
                "pw": "placeholder_hash",
            },
        )


async def seed_catalog(
    session: AsyncSession, tenants_by_slug: dict[str, dict]
) -> dict[str, dict]:
    catalog: dict[str, dict] = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        cat_ids: dict[str, uuid.UUID] = {}
        col_ids: dict[str, uuid.UUID] = {}
        products: list[tuple[uuid.UUID, uuid.UUID, str, float]] = []

        # Categories
        for sort_order, name in enumerate(CATEGORY_NAMES):
            cid = uuid.uuid4()
            cat_slug = name.lower().replace(" ", "-")
            await session.execute(
                text("""
                    INSERT INTO categories (id, tenant_id, name, slug, sort_order, is_active, created_at, updated_at)
                    VALUES (:id, :tid, :name, :slug, :sort_order, true, NOW(), NOW())
                    ON CONFLICT (tenant_id, slug) DO NOTHING
                """),
                {"id": cid, "tid": tenant_id, "name": name, "slug": cat_slug, "sort_order": sort_order},
            )
            cat_ids[cat_slug] = cid

        # Collections
        for sort_order, name in enumerate(COLLECTION_NAMES):
            col_id = uuid.uuid4()
            col_slug = name.lower().replace(" ", "-")
            await session.execute(
                text("""
                    INSERT INTO collections (id, tenant_id, name, slug, description, sort_order, is_active, created_at, updated_at)
                    VALUES (:id, :tid, :name, :slug, :desc, :sort_order, true, NOW(), NOW())
                    ON CONFLICT (tenant_id, slug) DO NOTHING
                """),
                {
                    "id": col_id, "tid": tenant_id, "name": name,
                    "slug": col_slug, "desc": f"{name} collection", "sort_order": sort_order,
                },
            )
            col_ids[col_slug] = col_id

        # Products, variants, and images
        cloudinary_prefix = "demo/products"
        for name, desc, sku, price, cat_slug, stock in PRODUCTS_BY_TENANT[slug]:
            pid = uuid.uuid4()
            product_slug = name.lower().replace(" ", "-")
            cat_id = cat_ids.get(cat_slug)

            await session.execute(
                text("""
                    INSERT INTO products (id, tenant_id, name, slug, description, price, status, sku, weight_unit, is_active, category_id, created_at, updated_at)
                    VALUES (:id, :tid, :name, :slug, :desc, :price, 'PUBLISHED', :sku, 'kg', true, :cat_id, NOW(), NOW())
                """),
                {
                    "id": pid, "tid": tenant_id, "name": name,
                    "slug": product_slug, "desc": desc, "price": price,
                    "sku": sku, "cat_id": cat_id,
                },
            )

            # Variant
            vid = uuid.uuid4()
            await session.execute(
                text("""
                    INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, options, created_at, updated_at)
                    VALUES (:id, :tid, :pid, :sku, :price, 'kg', :stock, true, '{}'::jsonb, NOW(), NOW())
                """),
                {
                    "id": vid, "tid": tenant_id, "pid": pid,
                    "sku": f"{sku}-VAR", "price": price, "stock": stock,
                },
            )

            # Images (3 per product: hero, detail-1, detail-2)
            for sort_order_i, suffix in enumerate(["hero", "detail-1", "detail-2"]):
                iid = uuid.uuid4()
                public_id = f"{cloudinary_prefix}/{product_slug}-{suffix}"
                await session.execute(
                    text("""
                        INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
                        VALUES (:id, :tid, :pid, :url, :alt, :sort_order, NOW(), NOW())
                    """),
                    {
                        "id": iid, "tid": tenant_id, "pid": pid,
                        "url": public_id,
                        "alt": f"{name} - {suffix.replace('-', ' ').title()}",
                        "sort_order": sort_order_i,
                    },
                )

            products.append((pid, vid, name, price))

        catalog[slug] = {
            "categories": cat_ids,
            "collections": col_ids,
            "products": products,
        }
    return catalog


async def seed_relationships(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
) -> None:
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        tc = catalog[slug]
        col_ids = list(tc["collections"].values())

        # Product-collection mapping
        for i, (pid, vid, name, price) in enumerate(tc["products"]):
            assigned: set[uuid.UUID] = set()
            if i % 2 == 0 and len(col_ids) > 1:
                assigned.add(col_ids[1])
            assigned.add(col_ids[i % len(col_ids)])
            for col_id in assigned:
                await session.execute(
                    text("""
                        INSERT INTO product_collections (product_id, collection_id, tenant_id, sort_order, created_at)
                        VALUES (:pid, :cid, :tid, :sort_order, NOW())
                    """),
                    {"pid": pid, "cid": col_id, "tid": tenant_id, "sort_order": i},
                )

        # Locations
        loc_data = [
            ("Main Warehouse", "100 Industrial Blvd", "Chicago", "IL", "60607"),
            ("Retail Store", "50 Downtown Ave", "Chicago", "IL", "60601"),
        ]
        loc_ids: list[uuid.UUID] = []
        for name, address, city, state, zipcode in loc_data:
            loc_id = uuid.uuid4()
            await session.execute(
                text("""
                    INSERT INTO locations (id, tenant_id, name, address, city, country, is_active, created_at, updated_at)
                    VALUES (:id, :tid, :name, :addr, :city, 'US', true, NOW(), NOW())
                """),
                {"id": loc_id, "tid": tenant_id, "name": name, "addr": address, "city": city},
            )
            loc_ids.append(loc_id)

        # Inventory (variant x location cartesian product)
        for pid, vid, name, price in tc["products"]:
            for loc_id in loc_ids:
                inv_id = uuid.uuid4()
                qty = random.randint(50, 200) if loc_id == loc_ids[0] else random.randint(5, 25)
                if random.random() < 0.1:
                    qty = 0
                await session.execute(
                    text("""
                        INSERT INTO inventory (id, tenant_id, variant_id, location_id, quantity, reserved_quantity, reorder_level, reorder_quantity, created_at, updated_at)
                        VALUES (:id, :tid, :vid, :lid, :qty, 0, 10, 50, NOW(), NOW())
                    """),
                    {"id": inv_id, "tid": tenant_id, "vid": vid, "lid": loc_id, "qty": qty},
                )


async def seed_customers(
    session: AsyncSession, tenants_by_slug: dict[str, dict]
) -> dict[str, list[uuid.UUID]]:
    result: dict[str, list[uuid.UUID]] = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        customer_ids: list[uuid.UUID] = []
        for first, last, email in CUSTOMERS_BY_TENANT[slug]:
            cid = uuid.uuid4()
            phone = f"+1{random.randint(200, 999)}{random.randint(100, 999)}{random.randint(1000, 9999)}"
            await session.execute(
                text("""
                    INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, refunded_total, created_at, updated_at)
                    VALUES (:id, :tid, :email, :first, :last, :phone, true, 0, 0, 0, NOW(), NOW())
                """),
                {"id": cid, "tid": tenant_id, "email": email, "first": first, "last": last, "phone": phone},
            )

            # 1-2 addresses per customer
            addr_count = random.randint(1, 2)
            for a in range(addr_count):
                addr_id = uuid.uuid4()
                idx = random.randint(0, len(STREETS) - 1)
                city_idx = random.randint(0, len(CITIES) - 1)
                await session.execute(
                    text("""
                        INSERT INTO customer_addresses (id, customer_id, tenant_id, address_type, line1, city, province, postal_code, country, is_default, created_at, updated_at)
                        VALUES (:id, :cid, :tid, :addr_type, :line1, :city, :province, :zip, :country, :is_default, NOW(), NOW())
                    """),
                    {
                        "id": addr_id, "cid": cid, "tid": tenant_id,
                        "addr_type": "shipping" if a == 0 else "billing",
                        "line1": STREETS[idx], "city": CITIES[city_idx],
                        "province": STATES[city_idx], "zip": ZIPCODES[city_idx],
                        "country": COUNTRY, "is_default": a == 0,
                    },
                )

            customer_ids.append(cid)
        result[slug] = customer_ids
    return result


async def seed_orders(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
    customers: dict[str, list[uuid.UUID]],
) -> None:
    order_number = 0
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        tc = catalog[slug]
        cust_ids = customers[slug]
        products = tc["products"]
        now = datetime.now(timezone.utc)

        num_orders = random.randint(15, 20)
        for _ in range(num_orders):
            order_number += 1
            oid = uuid.uuid4()
            customer_id = random.choice(cust_ids)

            items = random.sample(products, random.randint(1, min(3, len(products))))

            subtotal = 0.0
            order_items_data: list[tuple[uuid.UUID, uuid.UUID, str, float, int]] = []
            for pid, vid, pname, price in items:
                qty = random.randint(1, 3)
                subtotal += price * qty
                order_items_data.append((pid, vid, pname, price, qty))

            tax = round(subtotal * 0.08, 2)
            shipping = round(random.uniform(5.0, 25.0), 2)
            total = round(subtotal + tax + shipping, 2)

            status_choice = random.choices(
                ORDER_STATUSES + ["REFUNDED"],
                weights=ORDER_STATUS_WEIGHTS + [REFUNDED_WEIGHT],
                k=1,
            )[0]
            payment_status = "PAID" if status_choice in ("CONFIRMED", "SHIPPED", "DELIVERED") else \
                             "PENDING" if status_choice == "PENDING" else \
                             "REFUNDED"

            days_ago = random.randint(0, 30)
            ts = (now - timedelta(days=days_ago))

            await session.execute(
                text("""
                    INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, discount, total, currency, shipping_address, billing_address, notes, created_at, updated_at)
                    VALUES (:id, :tid, :ord_num, :cid, :status, :payment_status, :subtotal, :tax, :shipping, 0, :total, 'USD', '{}'::jsonb, '{}'::jsonb, '', :ts, :ts)
                """),
                {
                    "id": oid, "tid": tenant_id,
                    "ord_num": f"ORD-{order_number:04d}",
                    "cid": customer_id,
                    "status": status_choice,
                    "payment_status": payment_status,
                    "subtotal": subtotal,
                    "tax": tax,
                    "shipping": shipping,
                    "total": total,
                    "ts": ts,
                },
            )

            for pid, vid, pname, price, qty in order_items_data:
                await session.execute(
                    text("""
                        INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, discount, created_at, updated_at)
                        VALUES (:id, :tid, :oid, :vid, :pid, :pname, :vname, :sku, :qty, :unit_price, :total_price, 0, :ts, :ts)
                    """),
                    {
                        "id": uuid.uuid4(), "tid": tenant_id, "oid": oid,
                        "vid": vid, "pid": pid,
                        "pname": pname, "vname": f"{pname} - Default",
                        "sku": f"SKU-{order_number:04d}",
                        "qty": qty, "unit_price": price,
                        "total_price": price * qty, "ts": ts,
                    },
                )

    # Sync customer aggregates (orders.total is float; total_spent is BIGINT cents)
    await session.execute(text("""
        UPDATE customers c SET
            total_orders = sub.ord_count,
            total_spent = (sub.revenue * 100)::BIGINT,
            last_order_at = sub.last_at
        FROM (
            SELECT customer_id,
                   count(*) AS ord_count,
                   COALESCE(SUM(total), 0) AS revenue,
                   MAX(created_at) AS last_at
            FROM orders WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        ) sub
        WHERE c.id = sub.customer_id
    """))

    total_orders = await session.scalar(text("SELECT count(*) FROM orders"))
    total_items = await session.scalar(text("SELECT count(*) FROM order_items"))
    print(f"Orders: {total_orders}, Order items: {total_items}")


async def main() -> None:
    async with AsyncSession(engine) as session:
        async with session.begin():
            await clear_data(session)
            tenants = await seed_tenants(session)
            await seed_users(session, tenants)
            catalog = await seed_catalog(session, tenants)
            await seed_relationships(session, tenants, catalog)
            customers = await seed_customers(session, tenants)
            await seed_orders(session, tenants, catalog, customers)

        total_tenants = len(tenants)
        total_products = sum(len(PRODUCTS_BY_TENANT[s]) for s in tenants)
        total_customers = sum(len(CUSTOMERS_BY_TENANT[s]) for s in tenants)
        print(f"\nDatabase seeded successfully!")
        print(f"Tenants: {total_tenants}, Products: {total_products}, Customers: {total_customers}")


if __name__ == "__main__":
    asyncio.run(main())
