# Database Seed Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal 385-line `seed_database.py` with a complete, idempotent seed that populates every table with realistic data across 3 tenants.

**Architecture:** Single Python file refactored into 6 focused async helper functions (`seed_tenants`, `seed_users`, `seed_catalog`, `seed_relationships`, `seed_customers`, `seed_orders`) called in order by a `main()` orchestrator. All run inside one asyncpg transaction — any failure triggers a full rollback. Data is truncated before seeding (except `tenants` table) so re-runs start clean.

**Tech Stack:** Python 3.12+, asyncpg, PostgreSQL with Supabase RLS.

**Spec:** `docs/superpowers/specs/2026-07-09-database-seed-design.md`

## Global Constraints

- All customer data must be fictional (no real PII).
- Every variant must have an inventory row for every location (variant × location cartesian product).
- Order-item generation must only select variants from the order's own tenant's product set (never cross-tenant).
- The `tenants` table is never truncated — only child tables are cleared before re-seeding.
- Tenant-level admins get `is_platform_superuser = false` with `role = 'admin'`.
- Use asyncpg with raw SQL (not SQLModel AsyncSession) for speed.
- Run time under 5 seconds on a local Supabase instance.

---

## File Structure

Only one file is modified: `services/backend-api/seed_database.py`. The file is
refactored from a flat 385-line script into focused helper functions:

```
services/backend-api/seed_database.py
├── clear_data(conn)                    — truncate child tables in reverse-dep order
├── seed_tenants(conn)                  → tenants_by_slug: dict[str, TenantRow]
├── seed_users(conn, tenants_by_slug)   → None
├── seed_catalog(conn, tenants_by_slug) → catalog: dict[str, TenantCatalog]
├── seed_relationships(conn, tenants_by_slug, catalog) → None
├── seed_customers(conn, tenants_by_slug)  → customers: dict[str, list[uuid.UUID]]
├── seed_orders(conn, tenants_by_slug, catalog, customers) → None
└── main()                              — orchestrator, calls above in order
```

Where:

```
TenantRow = dict with keys: id, tenant_id, slug, name
TenantCatalog = dict with keys:
    categories: dict[str, uuid.UUID]          # slug → id
    collections: dict[str, uuid.UUID]         # slug → id
    products: list[tuple[uuid.UUID, uuid.UUID, str, float]]  # [(product_id, variant_id, name, price)]
```

---

### Task 1: Script foundation — constants, helpers, truncation, main skeleton

**Files:**
- Modify: `services/backend-api/seed_database.py` (replace entire file)

**Interfaces:**
- Consumes: nothing (this is the first task)
- Produces: `clear_data(conn)` function, `main()` skeleton with connection
  management, all constant data structures (tenant metadata, category names,
  collection names, product data, customer names, address data)

- [ ] **Step 1: Write the script skeleton with constants and helper stubs**

```python
"""Database seed script for multi-tenant shopify platform.

Idempotent — truncates all tenant-scoped data, then re-seeds from scratch.
Runs inside a single transaction; any failure triggers a full rollback.
"""

import asyncio
import asyncpg
import os
import random
import uuid
from datetime import datetime, timedelta, timezone

random.seed(42)  # reproducible results across runs

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set")
DATABASE_URL = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

# ── Tenant metadata ──────────────────────────────────────────────────

TENANTS = [
    {"slug": "acme-corp", "name": "Acme Corp", "plan": "starter"},
    {"slug": "globex-inc", "name": "Globex Inc", "plan": "business"},
    {"slug": "initech", "name": "Initech", "plan": "enterprise"},
]

# ── Catalog data ─────────────────────────────────────────────────────

CATEGORY_NAMES = ["Outerwear", "Footwear", "Accessories", "Bottoms", "Tops"]

COLLECTION_NAMES = ["New Arrivals", "Best Sellers", "Seasonal", "Featured"]

ACME_PRODUCTS = [
    ("Rocket Skates", "Classic rocket-powered skates", "RSK-001", 299.99, "footwear", 100),
    ("Laser Watch", "Watch with built-in laser", "LWS-002", 149.99, "accessories", 100),
    ("Tornado Machine", "Personal weather control device", "TWM-003", 499.99, "outerwear", 50),
    ("Shrink Ray", "Portable size-reduction device", "SRY-004", 199.99, "accessories", 75),
    ("Teleporter", "Instant transportation device", "TLP-005", 999.99, "accessories", 25),
]

GLOBEX_PRODUCTS = [
    ("DeLorean Time Machine", "Go back to the future", "DTM-001", 1499.99, "outerwear", 10),
    ("Plutonium Core", "Power source for time machines", "PLT-002", 750.00, "accessories", 200),
    ("Flux Capacitor", "1.21 gigawatts required", "FLX-003", 599.99, "accessories", 50),
    ("Hoverboard", "Anti-gravity personal transport", "HVB-004", 399.99, "footwear", 150),
]

INITECH_PRODUCTS = [
    ("TPS Report Generator", "Automate your paper pushing", "TPS-001", 9.99, "accessories", 999),
    ("Staple Remover Pro", "Professional-grade staple removal", "SRP-002", 4.99, "accessories", 500),
    ("Meeting Scheduler", "Schedule unnecessary meetings", "MTS-003", 0.00, "accessories", 0),
]

PRODUCTS_BY_TENANT = {
    "acme-corp": ACME_PRODUCTS,
    "globex-inc": GLOBEX_PRODUCTS,
    "initech": INITECH_PRODUCTS,
}

# ── Customer data ────────────────────────────────────────────────────

CUSTOMERS_BY_TENANT = {
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
# Roughly: 60% completed, 20% pending, 10% cancelled, 10% refunded
random.seed(42)  # reproducible results across runs


async def clear_data(conn: asyncpg.Connection) -> None:
    """Truncate all tenant-scoped child tables in reverse dependency order.

    The ``tenants`` table is preserved so stable tenant UUIDs survive re-runs.
    """
    tables = [
        "order_items", "orders", "inventory", "locations",
        "product_collections", "collections", "customer_addresses",
        "customers", "product_images", "variants", "products",
        "categories", "tenant_users",
    ]
    for table in tables:
        await conn.execute(f"DELETE FROM {table}")


async def seed_tenants(conn: asyncpg.Connection) -> dict[str, dict]:
    """Ensure the 3 stable tenants exist. Returns {slug: row}."""
    ...


async def seed_users(conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]) -> None:
    ...


async def seed_catalog(conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]) -> dict[str, dict]:
    ...


async def seed_relationships(
    conn: asyncpg.Connection, tenants_by_slug: dict[str, dict], catalog: dict[str, dict]
) -> None:
    ...


async def seed_customers(
    conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]
) -> dict[str, list[uuid.UUID]]:
    ...


async def seed_orders(
    conn: asyncpg.Connection,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
    customers: dict[str, list[uuid.UUID]],
) -> None:
    ...


async def main() -> None:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await clear_data(conn)
        tenants = await seed_tenants(conn)
        await seed_users(conn, tenants)
        catalog = await seed_catalog(conn, tenants)
        await seed_relationships(conn, tenants, catalog)
        customers = await seed_customers(conn, tenants)
        await seed_orders(conn, tenants, catalog, customers)
        await conn.commit()
        total_tenants = len(tenants)
        total_products = sum(len(PRODUCTS_BY_TENANT[s]) for s in tenants)
        total_customers = sum(len(CUSTOMERS_BY_TENANT[s]) for s in tenants)
        print(f"\nDatabase seeded successfully!")
        print(f"Tenants: {total_tenants}, Products: {total_products}, Customers: {total_customers}")
    except Exception as e:
        print(f"Error seeding database: {e}")
        raise
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())


### Task 7: Full integration test — run the complete seed script

**Files:**
- No code changes. Run the script end-to-end against a local Supabase DB.

- [ ] **Step 1: Run the complete seed**

```bash
cd services/backend-api
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres" python seed_database.py
```

Expected output (numbers will vary slightly due to randomness):
```
Orders: 52, Order items: 104
Database seeded successfully!
Tenants: 3, Products: 12, Customers: 25
```

- [ ] **Step 2: Verify data integrity with a quick query**

```bash
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres" python -c "
import asyncio, asyncpg, os
url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
async def check():
    conn = await asyncpg.connect(url)
    tables = ['tenants','tenant_users','categories','collections','products','variants','product_images','product_collections','locations','inventory','customers','customer_addresses','orders','order_items']
    for t in tables:
        c = await conn.fetchval(f'SELECT count(*) FROM {t}')
        print(f'{t}: {c}')
    await conn.close()
asyncio.run(check())
"
```

Expected: every table has > 0 rows, inventory = variants × locations (24 per tenant),
no cross-tenant data in orders.

- [ ] **Step 3: Re-run and confirm idempotency**

```bash
cd services/backend-api
DATABASE_URL="..." python seed_database.py
```

Expected: second run succeeds with same output pattern (no duplicate-key errors).

- [ ] **Step 4: Commit the final script**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add order and order-item seeding"
```
```

- [ ] **Step 2: Define TenantRow and TenantCatalog type aliases at the top**

```python
from collections.abc import Sequence

TenantRow = dict[str, str]  # keys: id, tenant_id, slug, name
TenantCatalog = dict[str, object]  # keys: categories, collections, products, categories, images
```

- [ ] **Step 3: Run a syntax check**

```bash
python -c "import ast; ast.parse(open('services/backend-api/seed_database.py').read()); print('Syntax OK')"
```

Expected: `Syntax OK`

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add script skeleton with constants and clear_data"
```


### Task 2: Layer 1 — Tenants and tenant_users

**Files:**
- Modify: `services/backend-api/seed_database.py` (implement `seed_tenants` and `seed_users`)

**Interfaces:**
- Consumes: `TENANTS` constant list
- Produces: `seed_tenants(conn) → dict[str, TenantRow]`

- [ ] **Step 1: Implement seed_tenants**

Replace the `seed_tenants` stub with:

```python
async def seed_tenants(conn: asyncpg.Connection) -> dict[str, dict]:
    rows = await conn.fetch(
        "SELECT id, tenant_id, slug, name FROM tenants WHERE slug = ANY($1)",
        [t["slug"] for t in TENANTS],
    )
    result = {r["slug"]: dict(r) for r in rows}
    for t in TENANTS:
        if t["slug"] not in result:
            tid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO tenants (id, tenant_id, name, slug, plan, status, settings, options, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '{}', '{}', NOW(), NOW())
                   ON CONFLICT (slug) DO NOTHING""",
                tid, tid, t["name"], t["slug"], t["plan"],
            )
    # Re-fetch to get the fresh rows
    rows = await conn.fetch(
        "SELECT id, tenant_id, slug, name FROM tenants WHERE slug = ANY($1)",
        [t["slug"] for t in TENANTS],
    )
    return {r["slug"]: dict(r) for r in rows}
```

- [ ] **Step 2: Implement seed_users**

Replace the `seed_users` stub with:

```python
async def seed_users(conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]) -> None:
    for slug, tenant in tenants_by_slug.items():
        await conn.execute(
            """INSERT INTO tenant_users (id, tenant_id, clerk_user_id, email, role, is_active, is_platform_superuser, created_at, updated_at)
               VALUES ($1, $2, $3, $4, 'admin', true, false, NOW(), NOW())
               ON CONFLICT DO NOTHING""",
            uuid.uuid4(), tenant["tenant_id"], f"clerk_{slug}_admin", f"admin@{slug}.com",
        )
```

- [ ] **Step 3: Verify Layer 1 runs without error**

```bash
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres" python seed_database.py
```

Expected: Script runs (will error on Layer 2 since stubs remain, but Layers 1 completes)

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add tenant and user seeding"
```


### Task 3: Layer 2 — Catalog (categories, collections, products, variants, images)

**Files:**
- Modify: `services/backend-api/seed_database.py` (implement `seed_catalog`)

**Interfaces:**
- Consumes: `tenants_by_slug`, `CATEGORY_NAMES`, `COLLECTION_NAMES`,
  `PRODUCTS_BY_TENANT` constants
- Produces: `TenantCatalog` dict with keys: `categories`, `collections`,
  `products`, `images`

- [ ] **Step 1: Implement seed_catalog**

Replace the `seed_catalog` stub with:

```python
async def seed_catalog(conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]) -> dict[str, dict]:
    catalog = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = tenant["tenant_id"]
        cat_ids: dict[str, uuid.UUID] = {}
        col_ids: dict[str, uuid.UUID] = {}
        products: list[tuple[uuid.UUID, uuid.UUID]] = []

        # ── Categories ──────────────────────────────────────────
        for sort_order, name in enumerate(CATEGORY_NAMES):
            cid = uuid.uuid4()
            cat_slug = name.lower().replace(" ", "-")
            await conn.execute(
                """INSERT INTO categories (id, tenant_id, name, slug, is_active, sort_order, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
                   ON CONFLICT (tenant_id, slug) DO NOTHING""",
                cid, tenant_id, name, cat_slug, sort_order,
            )
            cat_ids[cat_slug] = cid

        # ── Collections ─────────────────────────────────────────
        for sort_order, name in enumerate(COLLECTION_NAMES):
            col_id = uuid.uuid4()
            col_slug = name.lower().replace(" ", "-")
            await conn.execute(
                """INSERT INTO collections (id, tenant_id, name, slug, description, sort_order, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
                   ON CONFLICT (tenant_id, slug) DO NOTHING""",
                col_id, tenant_id, name, col_slug, f"{name} collection", sort_order,
            )
            col_ids[col_slug] = col_id

        # ── Products, variants, images ──────────────────────────
        cloudinary_prefix = "demo/products"
        for name, desc, sku, price, cat_slug, stock in PRODUCTS_BY_TENANT[slug]:
            pid = uuid.uuid4()
            product_slug = name.lower().replace(" ", "-")
            cat_id = cat_ids.get(cat_slug)
            await conn.execute(
                """INSERT INTO products (id, tenant_id, name, slug, description, price, status, sku, weight_unit, is_active, category_id, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', $7, 'kg', true, $8, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                pid, tenant_id, name, product_slug, desc, price, sku, cat_id,
            )

            # Variant
            vid = uuid.uuid4()
            await conn.execute(
                """INSERT INTO variants (id, tenant_id, product_id, sku, price, weight_unit, inventory_quantity, is_active, options, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'kg', $6, true, '{}'::jsonb, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                vid, tenant_id, pid, f"{sku}-VAR", price, stock,
            )

            # Images
            for sort_order_i, suffix in enumerate(["hero", "detail-1", "detail-2"]):
                iid = uuid.uuid4()
                public_id = f"{cloudinary_prefix}/{product_slug}-{suffix}"
                await conn.execute(
                    """INSERT INTO product_images (id, tenant_id, product_id, url, alt_text, sort_order, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    iid, tenant_id, pid, public_id,
                    f"{name} - {suffix.replace('-', ' ').title()}",
                    sort_order_i,
                )

            products.append((pid, vid, name, price))

        catalog[slug] = {
            "categories": cat_ids,
            "collections": col_ids,
            "products": products,
        }
    return catalog
```

- [ ] **Step 2: Verify it runs**

```bash
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:54322/postgres" python -c "
from seed_database import clear_data, seed_tenants, seed_catalog, DATABASE_URL
import asyncio, asyncpg
async def test():
    conn = await asyncpg.connect(DATABASE_URL)
    await clear_data(conn)
    tenants = await seed_tenants(conn)
    cat = await seed_catalog(conn, tenants)
    for slug, data in cat.items():
        print(f'{slug}: {len(data[\"categories\"])} cats, {len(data[\"collections\"])} cols, {len(data[\"products\"])} products')
    await conn.execute('ROLLBACK')
    await conn.close()
asyncio.run(test())
"
```

Expected: prints 3 lines with category/collection/product counts

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add catalog seeding (categories, collections, products, variants, images)"
```


### Task 4: Layer 3 — Relationships (product_collections, locations, inventory)

**Files:**
- Modify: `services/backend-api/seed_database.py` (implement `seed_relationships`)

**Interfaces:**
- Consumes: `tenants_by_slug`, `catalog` (from Task 3)
- Produces: nothing (side-effect: populates product_collections, locations, inventory)

- [ ] **Step 1: Implement seed_relationships**

Replace the stub with:

```python
async def seed_relationships(
    conn: asyncpg.Connection, tenants_by_slug: dict[str, dict], catalog: dict[str, dict]
) -> None:
    for slug, tenant in tenants_by_slug.items():
        tenant_id = tenant["tenant_id"]
        tc = catalog[slug]
        col_ids = list(tc["collections"].values())

        # ── Product-collection mapping ──────────────────────────
        # Distribute products across collections: each product goes to 1-2 collections
        for i, (pid, vid) in enumerate(tc["products"]):
            assigned = set()
            # Always assign to "Best Sellers" for even-indexed products
            if i % 2 == 0 and len(col_ids) > 1:
                assigned.add(col_ids[1])
            # Assign to round-robin collection
            assigned.add(col_ids[i % len(col_ids)])
            for col_id in assigned:
                await conn.execute(
                    """INSERT INTO product_collections (product_id, collection_id, tenant_id, sort_order, created_at)
                       VALUES ($1, $2, $3, $4, NOW())
                       ON CONFLICT DO NOTHING""",
                    pid, col_id, tenant_id, i,
                )

        # ── Locations ───────────────────────────────────────────
        loc_data = [
            ("Main Warehouse", "100 Industrial Blvd", "Warehouse District", "Chicago", "IL", "60607"),
            ("Retail Store", "50 Downtown Ave", "Shopping District", "Chicago", "IL", "60601"),
        ]
        loc_ids = []
        for name, addr, city_extra, city, state, zipcode in loc_data:
            loc_id = uuid.uuid4()
            await conn.execute(
                """INSERT INTO locations (id, tenant_id, name, address, city, country, is_active, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, 'US', true, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                loc_id, tenant_id, name, addr, city,
            )
            loc_ids.append(loc_id)

        # ── Inventory ───────────────────────────────────────────
        # Cartesian product: every variant × every location
        for pid, vid in tc["products"]:
            for loc_id in loc_ids:
                inv_id = uuid.uuid4()
                # Vary stock: warehouse gets 50-200, retail gets 5-25
                qty = random.randint(50, 200) if loc_id == loc_ids[0] else random.randint(5, 25)
                # Some items at 0 for low-stock testing
                if random.random() < 0.1:
                    qty = 0
                await conn.execute(
                    """INSERT INTO inventory (id, tenant_id, variant_id, location_id, quantity, reserved_quantity, reorder_level, reorder_quantity, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    inv_id, tenant_id, vid, loc_id, qty, 0, 10, 50,
                )
```

- [ ] **Step 2: Verify it runs**

```bash
DATABASE_URL="..." python -c "
from seed_database import clear_data, seed_tenants, seed_catalog, seed_relationships, DATABASE_URL
import asyncio, asyncpg
async def test():
    conn = await asyncpg.connect(DATABASE_URL)
    await clear_data(conn)
    tenants = await seed_tenants(conn)
    catalog = await seed_catalog(conn, tenants)
    await seed_relationships(conn, tenants, catalog)
    rows = await conn.fetch('SELECT count(*) as c FROM inventory')
    print(f'Inventory rows: {rows[0][\"c\"]}')
    await conn.execute('ROLLBACK')
    await conn.close()
asyncio.run(test())
"
```

Expected: `Inventory rows: 72` (24 per tenant × 3 tenants)

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add relationships seeding (product_collections, locations, inventory)"
```


### Task 5: Layer 4 — Customers and addresses

**Files:**
- Modify: `services/backend-api/seed_database.py` (implement `seed_customers`)

**Interfaces:**
- Consumes: `tenants_by_slug`, `CUSTOMERS_BY_TENANT`, `STREETS`, `CITIES`,
  `STATES`, `ZIPCODES`, `COUNTRY` constants
- Produces: `customers: dict[str, list[uuid.UUID]]` — {tenant_slug: [customer_id, ...]}

- [ ] **Step 1: Implement seed_customers**

Replace the stub with:

```python
async def seed_customers(
    conn: asyncpg.Connection, tenants_by_slug: dict[str, dict]
) -> dict[str, list[uuid.UUID]]:
    result = {}
    for slug, tenant in tenants_by_slug.items():
        tenant_id = tenant["tenant_id"]
        customer_ids = []
        for first, last, email in CUSTOMERS_BY_TENANT[slug]:
            cid = uuid.uuid4()
            phone = f"+1{random.randint(200,999)}{random.randint(100,999)}{random.randint(1000,9999)}"
            await conn.execute(
                """INSERT INTO customers (id, tenant_id, email, first_name, last_name, phone, is_verified, total_orders, total_spent, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, true, 0, 0, NOW(), NOW())
                   ON CONFLICT DO NOTHING""",
                cid, tenant_id, email, first, last, phone,
            )

            # 1-2 addresses per customer
            addr_count = random.randint(1, 2)
            for a in range(addr_count):
                addr_id = uuid.uuid4()
                idx = random.randint(0, len(STREETS) - 1)
                city_idx = random.randint(0, len(CITIES) - 1)
                await conn.execute(
                    """INSERT INTO customer_addresses (id, customer_id, tenant_id, address_type, line1, city, province, postal_code, country, is_default, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
                       ON CONFLICT DO NOTHING""",
                    addr_id, cid, tenant_id,
                    "shipping" if a == 0 else "billing",
                    STREETS[idx], CITIES[city_idx], STATES[city_idx],
                    ZIPCODES[city_idx], COUNTRY, a == 0,
                )

            customer_ids.append(cid)
        result[slug] = customer_ids
    return result
```

- [ ] **Step 2: Verify it runs**

```bash
DATABASE_URL="..." python -c "
from seed_database import clear_data, seed_tenants, seed_customers, DATABASE_URL
import asyncio, asyncpg
async def test():
    conn = await asyncpg.connect(DATABASE_URL)
    await clear_data(conn)
    tenants = await seed_tenants(conn)
    customers = await seed_customers(conn, tenants)
    for slug, ids in customers.items():
        print(f'{slug}: {len(ids)} customers')
    await conn.execute('ROLLBACK')
    await conn.close()
asyncio.run(test())
"
```

Expected: customer counts per tenant (8, 9, 8)

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): add customer and address seeding"
```


### Task 6b: Update Layer 5 implementation to include customer agg sync

**Files:**
- Modify: `services/backend-api/seed_database.py` (the `seed_orders` function already includes
  the customer agg sync at the bottom of Task 6 Step 1)

**Note:** The customer aggregate update (`total_orders`, `total_spent`) is already included
in the `seed_orders` code above. This task exists as a reminder to verify it's present
before running.

- [ ] **Step 1: Verify the customer agg query is in seed_orders**

Check that `seed_orders` includes the `UPDATE customers` query that syncs
`total_orders` and `total_spent` from the orders table.

- [ ] **Step 2: Commit (if the verification required a fix)**

```bash
git add services/backend-api/seed_database.py
git commit -m "feat(seed): sync customer aggregates after order seeding"
```


### Task 6: Layer 5 — Orders and order items

**Files:**
- Modify: `services/backend-api/seed_database.py` (implement `seed_orders`)

**Interfaces:**
- Consumes: `tenants_by_slug`, `catalog` (from Task 3), `customers` (from Task 5)
- Produces: nothing (side-effect: populates orders, order_items)

- [ ] **Step 1: Implement seed_orders**

Replace the stub with:

```python
async def seed_orders(
    conn: asyncpg.Connection,
    tenants_by_slug: dict[str, dict],
    catalog: dict[str, dict],
    customers: dict[str, list[uuid.UUID]],
) -> None:
    order_number = 0
    for slug, tenant in tenants_by_slug.items():
        tenant_id = tenant["tenant_id"]
        tc = catalog[slug]
        cust_ids = customers[slug]
        products = tc["products"]
        now = datetime.now(timezone.utc)

        num_orders = random.randint(15, 20)
        for _ in range(num_orders):
            order_number += 1
            oid = uuid.uuid4()
            customer_id = random.choice(cust_ids)

            # Pick 1-3 random items from this tenant's products
            items = random.sample(products, random.randint(1, min(3, len(products))))

            subtotal = 0.0
            order_items_data = []
            for pid, vid, pname, price in items:
                qty = random.randint(1, 3)
                subtotal += price * qty
                order_items_data.append((pid, vid, pname, price, qty))

            tax = round(subtotal * 0.08, 2)
            shipping = round(random.uniform(5.0, 25.0), 2)
            total = round(subtotal + tax + shipping, 2)

            status = random.choices(
                ORDER_STATUSES + ["REFUNDED"],
                weights=[0.25, 0.25, 0.10, 0.20, 0.10, 0.10],
                k=1,
            )[0]
            payment_status = "PAID" if status in ("CONFIRMED", "SHIPPED", "DELIVERED") else \
                             "PENDING" if status == "PENDING" else \
                             "REFUNDED"

            days_ago = random.randint(0, 30)
            ts = (now - timedelta(days=days_ago)).isoformat()

            await conn.execute(
                """INSERT INTO orders (id, tenant_id, order_number, customer_id, status, payment_status, subtotal, tax, shipping, total, currency, created_at, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'usd', $11, $11)
                   ON CONFLICT DO NOTHING""",
                oid, tenant_id, f"ORD-{order_number:04d}", customer_id,
                status, payment_status, subtotal, tax, shipping, total, ts,
            )

            for pid, vid, pname, price, qty in order_items_data:
                await conn.execute(
                    """INSERT INTO order_items (id, tenant_id, order_id, variant_id, product_id, product_name, variant_name, sku, quantity, unit_price, total_price, created_at, updated_at)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
                       ON CONFLICT DO NOTHING""",
                    uuid.uuid4(), tenant_id, oid, vid, pid,
                    pname, f"{pname} VAR", f"SKU-{order_number:04d}", qty, price, price * qty, ts,
                )

    total_orders = await conn.fetchval("SELECT count(*) FROM orders")
    total_items = await conn.fetchval("SELECT count(*) FROM order_items")
    print(f"Orders: {total_orders}, Order items: {total_items}")

    # Update customer agg counts
    await conn.execute("""
        UPDATE customers c SET
            total_orders = sub.ord_count,
            total_spent = sub.revenue
        FROM (
            SELECT customer_id, count(*) AS ord_count, COALESCE(sum(total), 0) AS revenue
            FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id
        ) sub
        WHERE c.id = sub.customer_id
    """)
```

Wait, there's a problem with the product_name lookup — `next(p[0] for p in PRODUCTS_BY_TENANT[slug])` would return the first product every time. I need to fix this. Let me use a dict lookup instead.

Actually, let me store a mapping from (pid, vid) to product name in the catalog. Let me update the `seed_catalog` to include product names.

Actually, the better approach: just pass product names through. Let me revise the catalog structure to include product names alongside the IDs.

Let me think about this differently. The `products` list in the catalog is `list[tuple[uuid.UUID, uuid.UUID]]` — `[(product_id, variant_id)]`. For order items, I need to know which product name/price corresponds to which product_id. Let me store the product data as tuples of `(product_id, variant_id, product_name, price)`.

I should revise Task 3's catalog to include this. Let me adjust.

Actually, I think the cleanest approach is to change the catalog's `products` value from `list[tuple[uuid.UUID, uuid.UUID]]` to `list[dict]` or `list[tuple]` with more fields.

Let me revise the plan to have `products` store `(pid, vid, name, price)` tuples.

This is a good catch during the plan-writing phase. Let me fix it.<｜end▁of▁thinking｜>I need to fix a data issue in the plan — the order items need product names and prices from the catalog. Let me revise:

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="read">
<｜｜DSML｜｜parameter name="filePath" string="true">/Users/giogunn/WebstormProjects/multi-tenant-shopify/docs/superpowers/plans/2026-07-09-database-seed.md