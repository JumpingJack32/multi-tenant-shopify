"""Database seed script for multi-tenant shopify platform.

Idempotent -- truncates all tenant-scoped data, then re-seeds from scratch.
Runs inside a single transaction; any failure triggers a full rollback.
"""

import asyncio
from datetime import datetime, timedelta, timezone
import json
import os
import random
import uuid

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import text

from src.orm.base import BaseModel
import src.orm.models  # noqa: F401 — register all models with BaseModel.metadata

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

ACME_PRODUCTS: list[tuple[str, str, str, int, str, int, int]] = [
    ("Rocket Skates", "Classic rocket-powered skates", "RSK-001", 29999, "footwear", 100, 15000),
    ("Laser Watch", "Watch with built-in laser", "LWS-002", 14999, "accessories", 100, 7500),
    ("Tornado Machine", "Personal weather control device", "TWM-003", 49999, "outerwear", 50, 25000),
    ("Shrink Ray", "Portable size-reduction device", "SRY-004", 19999, "accessories", 75, 10000),
    ("Teleporter", "Instant transportation device", "TLP-005", 99999, "accessories", 25, 50000),
]

GLOBEX_PRODUCTS: list[tuple[str, str, str, int, str, int, int]] = [
    ("DeLorean Time Machine", "Go back to the future", "DTM-001", 149999, "outerwear", 10, 75000),
    ("Plutonium Core", "Power source for time machines", "PLT-002", 75000, "accessories", 200, 37500),
    ("Flux Capacitor", "1.21 gigawatts required", "FLX-003", 59999, "accessories", 50, 30000),
    ("Hoverboard", "Anti-gravity personal transport", "HVB-004", 39999, "footwear", 150, 20000),
]

INITECH_PRODUCTS: list[tuple[str, str, str, int, str, int, int]] = [
    ("TPS Report Generator", "Automate your paper pushing", "TPS-001", 999, "accessories", 999, 500),
    ("Staple Remover Pro", "Professional-grade staple removal", "SRP-002", 499, "accessories", 500, 250),
    ("Meeting Scheduler", "Schedule unnecessary meetings", "MTS-003", 0, "accessories", 0, 0),
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

# ── Supplier data ─────────────────────────────────────────────────────

SUPPLIERS_BY_TENANT: dict[str, list[tuple[str, str, str, str]]] = {
    "acme-corp": [
        ("Acme Raw Materials", "supplier@acme-raw.com", "+1-555-0101", "manual_email"),
        ("Global Logistics Co", "orders@globallogistics.com", "+1-555-0102", "api"),
        ("Premium Parts Inc", "sales@premiumparts.com", "+1-555-0103", "manual_email"),
    ],
    "globex-inc": [
        ("FutureTech Supplies", "info@futuretech.com", "+1-555-0201", "manual_email"),
        ("TimeLab Components", "orders@timelab.com", "+1-555-0202", "api"),
        ("RetroParts Ltd", "sales@retroparts.com", "+1-555-0203", "manual_email"),
    ],
    "initech": [
        ("OfficeMax Supply Co", "orders@officemax.com", "+1-555-0301", "manual_email"),
        ("Swift Logistics", "dispatch@swiftlogistics.com", "+1-555-0302", "api"),
        ("BulkBuy Direct", "sales@bulkbuydirect.com", "+1-555-0303", "manual_email"),
    ],
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
        "store_credit_transactions", "customer_timeline_events",
        "order_fulfillment_links", "stock_transfer_items", "stock_transfers",
        "purchase_order_items", "purchase_orders",
        "po_sequences",
        "order_items", "orders",
        "inventory", "locations",
        "product_collections", "collections", "customer_addresses",
        "customers", "product_images", "variants", "products",
        "suppliers",
        "categories", "tenant_users",
    ]
    for table in tables:
        await session.execute(text(f"DELETE FROM {table}"))
    # Remove test tenants that may have been created by test suites
    await session.execute(text("DELETE FROM tenants WHERE slug LIKE 'create-%'"))
    await session.execute(text("DELETE FROM tenants WHERE slug LIKE 'get-%'"))
    await session.execute(text("DELETE FROM tenants WHERE slug LIKE 'update-%'"))
    await session.execute(text("DELETE FROM tenants WHERE slug = 'test-tenant'"))


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


async def seed_tax_configs(session: AsyncSession, tenants_by_slug: dict[str, dict]) -> None:
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        await session.execute(
            text("""
                INSERT INTO tenant_tax_configs (id, tenant_id, default_rate, tax_inclusive, enabled, created_at, updated_at)
                VALUES (:id, :tid, 2000, false, true, NOW(), NOW())
                ON CONFLICT DO NOTHING
            """),
            {"id": uuid.uuid4(), "tid": tenant_id},
        )


async def seed_suppliers(
    session: AsyncSession, tenants_by_slug: dict[str, dict]
) -> dict[str, list[dict]]:
    result: dict[str, list[dict]] = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        supplier_list: list[dict] = []
        for name, email, phone, method in SUPPLIERS_BY_TENANT[slug]:
            sid = uuid.uuid4()
            await session.execute(
                text("""
                    INSERT INTO suppliers (id, tenant_id, name, contact_email, contact_phone, delivery_method, created_at, updated_at)
                    VALUES (:id, :tid, :name, :email, :phone, :method, NOW(), NOW())
                """),
                {"id": sid, "tid": tenant_id, "name": name, "email": email, "phone": phone, "method": method},
            )
            # Keep the first supplier as the default for products
            supplier_list.append({"id": sid, "name": name, "delivery_method": method})
        result[slug] = supplier_list
    return result


async def seed_catalog(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    suppliers: dict[str, list[dict]],
) -> dict[str, dict]:
    catalog: dict[str, dict] = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        cat_ids: dict[str, uuid.UUID] = {}
        col_ids: dict[str, uuid.UUID] = {}
        products: list[tuple[uuid.UUID, uuid.UUID, str, int, uuid.UUID, str, int]] = []

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

        # Suppliers for this tenant
        supplier_list = suppliers[slug]
        default_supplier = supplier_list[0]

        # Products, variants, and images
        cloudinary_prefix = "demo/products"
        for name, desc, sku, price_cents, cat_slug, stock, cost_cents in PRODUCTS_BY_TENANT[slug]:
            pid = uuid.uuid4()
            vid = uuid.uuid4()
            product_slug = name.lower().replace(" ", "-")
            cat_id = cat_ids.get(cat_slug)

            await session.execute(
                text("""
                    INSERT INTO products (id, tenant_id, name, slug, description, status, sku, weight_unit, is_active, category_id, supplier_id, created_at, updated_at)
                    VALUES (:id, :tid, :name, :slug, :desc, 'PUBLISHED', :sku, 'kg', true, :cat_id, :sup_id, NOW(), NOW())
                """),
                {
                    "id": pid, "tid": tenant_id, "name": name,
                    "slug": product_slug, "desc": desc,
                    "sku": sku, "cat_id": cat_id, "sup_id": default_supplier["id"],
                },
            )

            # Variant with supplier fields
            await session.execute(
                text("""
                    INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, supplier_sku, cost_price, options, created_at, updated_at)
                    VALUES (:id, :tid, :pid, :sku, :price, 'kg', :stock, true, :sup_sku, :cost_price, '{}'::jsonb, NOW(), NOW())
                """),
                {
                    "id": vid, "tid": tenant_id, "pid": pid,
                    "sku": f"{sku}-VAR", "price": price_cents,
                    "stock": stock, "sup_sku": f"SUP-{sku}",
                    "cost_price": cost_cents,
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

            products.append((pid, vid, name, price_cents, default_supplier["id"], sku, cost_cents))

        catalog[slug] = {
            "categories": cat_ids,
            "collections": col_ids,
            "products": products,
            "suppliers": supplier_list,
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
        for i, (pid, vid, name, price_cents, sup_id, sku, cost_cents) in enumerate(tc["products"]):
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
        for pid, vid, name, price_cents, sup_id, sku, cost_cents in tc["products"]:
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
) -> dict[str, list[dict]]:
    """Seed customers with subscription, tags, credit fields.
    Returns metadata dicts for each customer to be used by child relation seeding."""
    SUB_STATUSES = ["subscribed", "subscribed", "subscribed", "unsubscribed", "bounced"]
    SUB_TYPES = ["digital", "digital", "print+digital", "print", "marketing"]
    TAG_SETS = [
        {},
        {"VIP": True, "holiday-shopper": True},
        {"wholesale": True},
        {"VIP": True, "loyalty": True},
        {"seasonal": True, "clearance": True},
        {"VIP": True},
        {"wholesale": True, "priority": True},
        {},
        {"holiday-shopper": True},
    ]

    now = datetime.now(timezone.utc)
    result: dict[str, list[dict]] = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        customer_meta: list[dict] = []
        customer_ids: list[uuid.UUID] = []
        for idx, (first, last, email) in enumerate(CUSTOMERS_BY_TENANT[slug]):
            cid = uuid.uuid4()
            phone = f"+1{random.randint(200, 999)}{random.randint(100, 999)}{random.randint(1000, 9999)}"

            tags = json.dumps(TAG_SETS[idx % len(TAG_SETS)])
            sub_status = random.choice(SUB_STATUSES)
            sub_type = random.choice(SUB_TYPES)
            store_credit_cents = random.choice([0, 0, 0, 500, 1000, 2500, 5000])
            last_synced = None
            if random.random() > 0.3:
                days_ago = random.randint(1, 60)
                last_synced = (now - timedelta(days=days_ago))

            notes_options = [
                None,
                "Prefers email communication. Called about Q1 delivery.",
                "VIP customer — offer priority shipping on next order.",
                "Reported issue with payment gateway. Followed up on 2026-06-15.",
                None,
                None,
                "Requested catalog for Spring 2026 collection.",
            ]
            notes = random.choice(notes_options)

            await session.execute(
                text("""
                    INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, refunded_total, last_order_at, email_subscription_status, email_subscription_type, tags, notes, store_credit, last_synced_at, language, email_marketing_consent, sms_marketing_consent, tax_exempt, created_at, updated_at)
                    VALUES (:id, :tid, :email, :first, :last, :phone, true, 0, 0, 0, NULL, :sub_status, :sub_type, CAST(:tags AS jsonb), :notes, :store_credit, :last_synced, 'en', false, false, false, NOW(), NOW())
                """),
                {
                    "id": cid, "tid": tenant_id,
                    "email": email, "first": first, "last": last, "phone": phone,
                    "sub_status": sub_status, "sub_type": sub_type,
                    "tags": tags, "notes": notes,
                    "store_credit": store_credit_cents,
                    "last_synced": last_synced,
                },
            )

            # 1-2 addresses per customer
            addr_count = random.randint(1, 2)
            for a in range(addr_count):
                addr_id = uuid.uuid4()
                idx_street = random.randint(0, len(STREETS) - 1)
                city_idx = random.randint(0, len(CITIES) - 1)
                await session.execute(
                    text("""
                        INSERT INTO customer_addresses (id, customer_id, tenant_id, address_type, line1, city, province, postal_code, country, company, label, is_default, is_default_shipping, is_default_billing, created_at, updated_at)
                        VALUES (:id, :cid, :tid, :addr_type, :line1, :city, :province, :zip, :country, NULL, 'Home', :is_default, :is_default, false, NOW(), NOW())
                    """),
                    {
                        "id": addr_id, "cid": cid, "tid": tenant_id,
                        "addr_type": "shipping" if a == 0 else "billing",
                        "line1": STREETS[idx_street], "city": CITIES[city_idx],
                        "province": STATES[city_idx], "zip": ZIPCODES[city_idx],
                        "country": COUNTRY, "is_default": a == 0,
                    },
                )

            customer_meta.append({
                "id": cid,
                "tenant_id": tenant_id,
                "store_credit": store_credit_cents,
                "created_days_ago": random.randint(1, 60),
            })
            customer_ids.append(cid)
        result[slug] = {"ids": customer_ids, "meta": customer_meta}
    return result


async def seed_customer_relations(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    customers: dict[str, dict],
) -> None:
    """Seed timeline events and store credit transactions for each customer."""
    EVENT_TYPES = ["note", "email_sent", "status_change", "tag_added"]
    EVENT_DESCRIPTIONS = [
        "Customer called about delivery status. Resolved.",
        "Welcome email sent successfully.",
        "Subscription changed from 'print' to 'digital'.",
        "Tag 'VIP' added based on purchase history.",
        "Follow-up email sent regarding Q2 campaign.",
        "Account status changed to verified.",
        "Customer requested catalog for new collection.",
    ]
    now = datetime.now(timezone.utc)

    for slug, tenant in tenants_by_slug.items():
        for c in customers[slug]["meta"]:
            cid = c["id"]
            tid = c["tenant_id"]
            base_days = c["created_days_ago"]

            # 1-3 timeline events per customer
            num_events = random.randint(1, 3)
            for _ in range(num_events):
                event_type = random.choice(EVENT_TYPES)
                description = random.choice(EVENT_DESCRIPTIONS)
                days_offset = random.randint(0, max(1, base_days))
                ts = (now - timedelta(days=days_offset))

                await session.execute(
                    text("""
                        INSERT INTO customer_timeline_events (id, tenant_id, customer_id, event_type, description, extra_data, created_by, created_at, updated_at)
                        VALUES (:id, :tid, :cid, :etype, :desc, '{}'::jsonb, NULL, :ts, :ts)
                    """),
                    {
                        "id": uuid.uuid4(), "tid": tid, "cid": cid,
                        "etype": event_type, "desc": description, "ts": ts,
                    },
                )

            # 0-2 store credit transactions for customers with credit
            if c["store_credit"] > 0:
                num_tx = random.randint(1, 2)
                remaining = c["store_credit"]
                for tx_idx in range(num_tx):
                    if remaining <= 0:
                        break
                    if tx_idx == num_tx - 1:
                        amount = remaining
                    else:
                        amount = random.randint(1, max(1, remaining // 2))
                    remaining -= amount

                    ts = (now - timedelta(days=random.randint(0, 30)))
                    reason = random.choice([
                        "Compensation for delayed delivery.",
                        "Loyalty bonus credit applied.",
                        "Refund for returned item.",
                        "Promotional credit for Q3 campaign.",
                    ])

                    await session.execute(
                        text("""
                            INSERT INTO store_credit_transactions (id, tenant_id, customer_id, amount, balance_after, reason, created_by, created_at, updated_at)
                            VALUES (:id, :tid, :cid, :amount, :balance, :reason, NULL, :ts, :ts)
                        """),
                        {
                            "id": uuid.uuid4(), "tid": tid, "cid": cid,
                            "amount": amount, "balance": remaining,
                            "reason": reason, "ts": ts,
                        },
                    )

                    # Also add a timeline event for the credit transaction
                    await session.execute(
                        text("""
                            INSERT INTO customer_timeline_events (id, tenant_id, customer_id, event_type, description, extra_data, created_by, created_at, updated_at)
                            VALUES (:id, :tid, :cid, 'credit_added', :desc, '{}'::jsonb, NULL, :ts, :ts)
                        """),
                        {
                            "id": uuid.uuid4(), "tid": tid, "cid": cid,
                            "desc": f"Credit of £{amount / 100:.2f} applied: {reason}",
                            "ts": ts,
                        },
                    )


async def seed_orders(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
    customers: dict[str, list[uuid.UUID]],
) -> dict[str, dict]:
    """Seed orders with integer-cent values and return order data for PO linking."""
    result: dict[str, dict] = {}
    order_number = 0
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        tc = catalog[slug]
        cust_ids = customers[slug]["ids"]
        products = tc["products"]
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        order_data: list[dict] = []

        num_orders = random.randint(15, 20)
        for _ in range(num_orders):
            order_number += 1
            oid = uuid.uuid4()
            customer_id = random.choice(cust_ids)

            items_sample = random.sample(products, random.randint(1, min(3, len(products))))

            subtotal = 0
            order_items_data: list[tuple[uuid.UUID, uuid.UUID, str, int, int, uuid.UUID, str, int]] = []
            for pid, vid, pname, price_cents, sup_id, sku, cost_cents in items_sample:
                qty = random.randint(1, 3)
                line_total = price_cents * qty
                subtotal += line_total
                order_items_data.append((pid, vid, pname, price_cents, qty, sup_id, sku, cost_cents))

            tax = int(subtotal * 0.08)
            shipping = random.randint(500, 2500)
            total = subtotal + tax + shipping

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
                    INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, discount, total, currency, base_currency, exchange_rate, total_base, shipping_address, billing_address, notes, inventory_deducted, created_at, updated_at)
                    VALUES (:id, :tid, :ord_num, :cid, :status, :payment_status, :subtotal, :tax, :shipping, 0, :total, 'USD', 'GBP', 1.0, :total, '{}'::jsonb, '{}'::jsonb, '', false, :ts, :ts)
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

            items_for_links: list[dict] = []
            for pid, vid, pname, price_cents, qty, sup_id, sku, cost_cents in order_items_data:
                oiid = uuid.uuid4()
                await session.execute(
                    text("""
                        INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, discount, tax_rate, tax_amount, created_at, updated_at)
                        VALUES (:id, :tid, :oid, :vid, :pid, :pname, :vname, :sku, :qty, :unit_price, :total_price, 0, 0, 0, :ts, :ts)
                    """),
                    {
                        "id": oiid, "tid": tenant_id, "oid": oid,
                        "vid": vid, "pid": pid,
                        "pname": pname, "vname": f"{pname} - Default",
                        "sku": f"SKU-{order_number:04d}",
                        "qty": qty, "unit_price": price_cents,
                        "total_price": price_cents * qty, "ts": ts,
                    },
                )
                items_for_links.append({
                    "order_item_id": oiid,
                    "variant_id": vid,
                    "quantity": qty,
                    "supplier_id": sup_id,
                    "cost_cents": cost_cents,
                    "product_name": pname,
                    "sku": sku,
                })

            order_data.append({
                "order_id": oid,
                "order_number": f"ORD-{order_number:04d}",
                "customer_id": customer_id,
                "status": status_choice,
                "tenant_id": tenant_id,
                "items": items_for_links,
            })

        result[slug] = order_data

    # Sync customer aggregates
    await session.execute(text("""
        UPDATE customers c SET
            total_orders = sub.ord_count,
            total_spent = sub.revenue,
            last_order_at = sub.last_at
        FROM (
            SELECT customer_id,
                   count(*) AS ord_count,
                   COALESCE(SUM(total), 0)::BIGINT AS revenue,
                   MAX(created_at) AS last_at
            FROM orders WHERE customer_id IS NOT NULL
            GROUP BY customer_id
        ) sub
        WHERE c.id = sub.customer_id
    """))

    total_orders = await session.scalar(text("SELECT count(*) FROM orders"))
    total_items = await session.scalar(text("SELECT count(*) FROM order_items"))
    print(f"Orders: {total_orders}, Order items: {total_items}")

    return result


async def seed_purchase_orders(
    session: AsyncSession,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
    order_data: dict[str, list[dict]],
) -> None:
    """Create purchase orders and fulfillment links for seeded orders."""
    for slug, tenant in tenants_by_slug.items():
        tenant_id = uuid.UUID(tenant["tenant_id"])
        tc = catalog[slug]
        suppliers = tc["suppliers"]
        orders = order_data[slug]
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Pick the last 4 orders to attach POs to
        po_candidates = orders[-4:] if len(orders) >= 4 else orders

        # Track which PO numbers we've used for this tenant
        po_counter = 0

        for idx, order in enumerate(po_candidates):
            po_counter += 1
            po_id = uuid.uuid4()
            supplier = suppliers[idx % len(suppliers)]

            if idx == 0:
                # pending_review #1 — no tracking, no dates
                status = "pending_review"
                fulfillment_strategy = "dropship"
                tracking_number = None
                carrier = None
                sent_at = None
                confirmed_at = None
                closed_at = None
            elif idx == 1:
                # pending_review #2 — different supplier, api delivery
                status = "pending_review"
                fulfillment_strategy = "dropship"
                tracking_number = None
                carrier = None
                sent_at = None
                confirmed_at = None
                closed_at = None
                supplier = suppliers[(idx + 1) % len(suppliers)]
            elif idx == 2:
                # in_transit
                status = "in_transit"
                fulfillment_strategy = "dropship"
                tracking_number = "1Z999AA10123456784"
                carrier = "UPS"
                sent_at = (now - timedelta(days=5))
                confirmed_at = (now - timedelta(days=4))
                closed_at = None
            else:
                # closed
                status = "closed"
                fulfillment_strategy = "dropship"
                tracking_number = "1Z888BB20234567891"
                carrier = "FedEx"
                sent_at = (now - timedelta(days=20))
                confirmed_at = (now - timedelta(days=19))
                closed_at = (now - timedelta(days=14))

            # Calculate PO totals from order items
            po_subtotal = 0
            item_count = 0
            for oi in order["items"]:
                qty = oi["quantity"]
                cost = oi["cost_cents"]
                po_subtotal += cost * qty
                item_count += qty

            po_tax = int(po_subtotal * 0.08)
            po_shipping = 0
            po_total = po_subtotal + po_tax + po_shipping

            po_number = f"PO-{now.strftime('%Y%m%d')}-{po_counter:04d}-SEED"

            await session.execute(
                text("""
                    INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_id, status, fulfillment_strategy, tracking_number, carrier, subtotal, tax, shipping_cost, total, notes, sent_at, confirmed_at, closed_at, created_at, updated_at)
                    VALUES (:id, :tid, :po_number, :sup_id, :status, :strategy, :tracking, :carrier, :subtotal, :tax, :shipping, :total, :notes, :sent_at, :confirmed_at, :closed_at, NOW(), NOW())
                """),
                {
                    "id": po_id, "tid": tenant_id,
                    "po_number": po_number,
                    "sup_id": supplier["id"],
                    "status": status,
                    "strategy": fulfillment_strategy,
                    "tracking": tracking_number,
                    "carrier": carrier,
                    "subtotal": po_subtotal,
                    "tax": po_tax,
                    "shipping": po_shipping,
                    "total": po_total,
                    "notes": f"Seeded PO from order {order['order_number']}",
                    "sent_at": sent_at,
                    "confirmed_at": confirmed_at,
                    "closed_at": closed_at,
                },
            )

            # Create PO items + fulfillment links for each order item
            for oi in order["items"]:
                poi_id = uuid.uuid4()
                qty = oi["quantity"]
                cost = oi["cost_cents"]
                line_subtotal = cost * qty

                await session.execute(
                    text("""
                        INSERT INTO purchase_order_items (id, tenant_id, purchase_order_id, variant_id, supplier_sku, product_name, variant_label, quantity, unit_cost, subtotal, created_at, updated_at)
                        VALUES (:id, :tid, :poi_id, :vid, :sup_sku, :pname, :vlabel, :qty, :unit_cost, :subtotal, NOW(), NOW())
                    """),
                    {
                        "id": poi_id, "tid": tenant_id,
                        "poi_id": po_id,
                        "vid": oi["variant_id"],
                        "sup_sku": f"SUP-{oi['sku']}",
                        "pname": oi["product_name"],
                        "vlabel": f"{oi['product_name']} - Default",
                        "qty": qty,
                        "unit_cost": cost,
                        "subtotal": line_subtotal,
                    },
                )

                # Fulfillment link
                await session.execute(
                    text("""
                        INSERT INTO order_fulfillment_links (id, tenant_id, order_item_id, purchase_order_item_id, quantity, created_at, updated_at)
                        VALUES (:id, :tid, :oiid, :poiiid, :qty, NOW(), NOW())
                    """),
                    {
                        "id": uuid.uuid4(), "tid": tenant_id,
                        "oiid": oi["order_item_id"],
                        "poiiid": poi_id,
                        "qty": qty,
                    },
                )

    total_pos = await session.scalar(text("SELECT count(*) FROM purchase_orders"))
    total_links = await session.scalar(text("SELECT count(*) FROM order_fulfillment_links"))
    print(f"Purchase orders: {total_pos}, Fulfillment links: {total_links}")


async def main() -> None:
    env = os.environ.get("DOPPLER_ENVIRONMENT", "unknown")
    if env != "dev":
        print(f"\n❌ Refusing to run in environment '{env}'. This script is restricted to dev.")
        print("   Set DOPPLER_ENVIRONMENT=dev or run via: doppler run -- uv run python seed_database.py")
        return

    print("\n⚠️  DESTRUCTIVE OPERATION — this will DELETE all tenant-scoped data.")
    print("    Tables that will be wiped: orders, customers, products, inventory,")
    print("    purchase orders, stock transfers, carts, and related records.")
    print("    Tenants and tenant_users are preserved (except test tenants).\n")

    confirm = input('Type "DESTROY AND RESEED" to continue: ')
    if confirm != "DESTROY AND RESEED":
        print("Aborted.")
        return

    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.drop_all)
        await conn.run_sync(BaseModel.metadata.create_all)
    async with AsyncSession(engine) as session:
        async with session.begin():
            await clear_data(session)
            tenants = await seed_tenants(session)
            await seed_users(session, tenants)
            await seed_tax_configs(session, tenants)
            suppliers = await seed_suppliers(session, tenants)
            catalog = await seed_catalog(session, tenants, suppliers)
            await seed_relationships(session, tenants, catalog)
            customers = await seed_customers(session, tenants)
            await seed_customer_relations(session, tenants, customers)
            order_data = await seed_orders(session, tenants, catalog, customers)
            await seed_purchase_orders(session, tenants, catalog, order_data)

        total_tenants = len(tenants)
        total_products = sum(len(PRODUCTS_BY_TENANT[s]) for s in tenants)
        total_customers = sum(len(CUSTOMERS_BY_TENANT[s]) for s in tenants)
        print("\nDatabase seeded successfully!")
        print(f"Tenants: {total_tenants}, Products: {total_products}, Customers: {total_customers}")


if __name__ == "__main__":
    asyncio.run(main())
