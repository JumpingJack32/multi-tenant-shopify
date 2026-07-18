"""Bulk load test data generator.

Creates 10k customers, 500 products, 50k orders for a single tenant.
Uses SQLAlchemy Core bulk insert — no ORM identity map.

Usage:
    uv run python scripts/seed_load_test.py

Environment:
    LOAD_TEST_DATABASE_URL — defaults to postgresql+asyncpg://postgres:postgres@localhost:54322/multi_tenant_shopify_load_test
"""

import asyncio
import os
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import insert, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

random.seed(99)

DB_URL = os.environ.get(
    "LOAD_TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:54322/multi_tenant_shopify_load_test",
)
engine = create_async_engine(DB_URL, echo=False)

TENANT_ID = "00000000-0000-0000-0000-000000000001"
NOW = datetime.now(timezone.utc)

FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "David", "Elizabeth"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
STREETS = ["Oak St", "Elm St", "Maple Ave", "Main St", "Park Rd", "Cedar Ln", "Pine Dr", "Birch Way", "Walnut Ct", "Cherry Blvd"]
CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "Austin"]
PRODUCT_NAMES = [f"Widget {c}" for c in "ABCDEFGHIJKLMNOPQRST"] + [f"Gadget {c}" for c in "ABCDEFGHIJKLMNOPQRST"] + \
                [f"Tool {c}" for c in "ABCDEFGHIJKLMNOPQRST"] + [f"Part {c}" for c in "ABCDEFGHIJKLMNOPQRST"] + \
                [f"Kit {c}" for c in "ABCDEFGHIJ"]  # 85 names, we create 500 by adding variants

SUB_STATUSES = ["subscribed", "subscribed", "subscribed", "unsubscribed", "bounced"]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)

    async with AsyncSession(engine) as db:
        batch_size = 500

        # ── Customers ────────────────────────────────────────────────
        print("Seeding 10,000 customers...")
        cid_map = {}
        for batch_start in range(0, 10000, batch_size):
            rows = []
            for i in range(batch_start, batch_start + batch_size):
                cid = uuid4()
                days_ago = random.randint(1, 365)
                created = NOW - timedelta(days=days_ago)
                rows.append({
                    "id": cid,
                    "tenant_id": TENANT_ID,
                    "email": f"user{i}@example.com",
                    "first_name": random.choice(FIRST_NAMES),
                    "last_name": random.choice(LAST_NAMES),
                    "phone": f"+1{random.randint(200,999)}{random.randint(100,999)}{random.randint(1000,9999)}",
                    "is_verified": True,
                    "total_orders": 0,
                    "total_spent": 0,
                    "refunded_total": 0,
                    "email_subscription_status": random.choice(SUB_STATUSES),
                    "email_subscription_type": "digital",
                    "tags": '{}',
                    "store_credit": 0,
                    "language": "en",
                    "email_marketing_consent": False,
                    "sms_marketing_consent": False,
                    "tax_exempt": False,
                    "last_synced_at": None,
                    "created_at": created,
                    "updated_at": created,
                })
                cid_map[cid] = created
            await db.execute(insert(Customer), rows)
            await db.flush()
            if (batch_start + batch_size) % 2000 == 0:
                print(f"  {batch_start + batch_size} customers...")

        # ── Customer Addresses ────────────────────────────────────────
        print("Seeding addresses...")
        addr_rows = []
        for cid in cid_map:
            addr_rows.append({
                "id": uuid4(),
                "tenant_id": TENANT_ID,
                "customer_id": cid,
                "address_type": "shipping",
                "line1": f"{random.randint(1,9999)} {random.choice(STREETS)}",
                "city": random.choice(CITIES),
                "province": "CA",
                "postal_code": f"{random.randint(10000,99999)}",
                "country": "US",
                "company": None,
                "label": "Home",
                "is_default": True,
                "is_default_shipping": True,
                "is_default_billing": False,
                "created_at": NOW,
                "updated_at": NOW,
            })
        await db.execute(insert(CustomerAddress), addr_rows)
        await db.flush()

        # ── Products & Variants ──────────────────────────────────────
        print("Seeding 500 products with ~1,000 variants...")
        product_ids = []
        variant_ids = []
        category_stmt = select(Category).where(Category.tenant_id == TENANT_ID)
        categories = (await db.exec(category_stmt)).all()
        cat_ids = [c.id for c in categories] if categories else [None]

        for i in range(500):
            pid = uuid4()
            product_ids.append(pid)
            await db.execute(insert(Product), [{
                "id": pid,
                "tenant_id": TENANT_ID,
                "name": random.choice(PRODUCT_NAMES) + f" #{i}",
                "slug": f"product-{i}",
                "status": "published",
                "is_active": True,
                "category_id": random.choice(cat_ids) if cat_ids else None,
                "created_at": NOW,
                "updated_at": NOW,
            }])

            # 1-3 variants per product
            for v in range(random.randint(1, 3)):
                vid = uuid4()
                variant_ids.append(vid)
                price = random.randint(500, 50000)
                await db.execute(insert(Variant), [{
                    "id": vid,
                    "tenant_id": TENANT_ID,
                    "product_id": pid,
                    "sku": f"SKU-{i}-{v}",
                    "price": price,
                    "inventory_quantity": random.randint(0, 200),
                    "is_active": True,
                    "options": '{}',
                    "created_at": NOW,
                    "updated_at": NOW,
                }])

            if (i + 1) % 100 == 0:
                print(f"  {i + 1} products...")
                await db.flush()
        await db.flush()

        # ── Orders ────────────────────────────────────────────────────
        print("Seeding 50,000 orders with ~150,000 order items...")
        cid_list = list(cid_map.keys())
        vid_list = list(variant_ids)
        order_count = 0
        item_count = 0

        for batch_start in range(0, 50000, 200):
            order_rows = []
            item_rows = []
            for _ in range(200):
                oid = uuid4()
                cid = random.choice(cid_list)
                customer_created = cid_map[cid]
                days_after = random.randint(0, max(1, (NOW - customer_created).days))
                order_date = customer_created + timedelta(days=days_after)

                num_items = random.randint(1, 5)
                subtotal = 0
                for _ in range(num_items):
                    vid = random.choice(vid_list)
                    qty = random.randint(1, 3)
                    price = random.randint(500, 30000)
                    line_total = price * qty
                    subtotal += line_total
                    item_rows.append({
                        "id": uuid4(),
                        "tenant_id": TENANT_ID,
                        "order_id": oid,
                        "variant_id": vid,
                        "quantity": qty,
                        "unit_price": price,
                        "total_price": line_total,
                        "tax_rate": 0,
                        "tax_amount": 0,
                        "created_at": order_date,
                        "updated_at": order_date,
                    })
                    item_count += 1

                tax_amt = int(subtotal * 0.08)
                shipping = random.randint(500, 2500)
                total = subtotal + tax_amt + shipping
                status = random.choice(["confirmed", "confirmed", "paid", "shipped", "delivered", "cancelled"])
                order_rows.append({
                    "id": oid,
                    "tenant_id": TENANT_ID,
                    "customer_id": cid,
                    "order_number": f"ORD-LT-{order_count:06d}",
                    "status": status,
                    "payment_status": "paid",
                    "subtotal": subtotal,
                    "tax": tax_amt,
                    "shipping": shipping,
                    "discount": 0,
                    "total": total,
                    "currency": "USD",
                    "base_currency": "GBP",
                    "exchange_rate": 1.0,
                    "total_base": total,
                    "shipping_address": "{}",
                    "billing_address": "{}",
                    "notes": "",
                    "inventory_deducted": True,
                    "created_at": order_date,
                    "updated_at": order_date,
                })
                order_count += 1

            await db.execute(insert(Order), order_rows)
            await db.execute(insert(OrderItem), item_rows)
            await db.flush()

            if order_count % 5000 == 0:
                print(f"  {order_count} orders ({item_count} items)...")

        # ── Sync customer aggregates ──────────────────────────────────
        print("Syncing customer aggregates...")
        await db.execute(text("""
            UPDATE customers c SET
                total_orders = sub.ord_count,
                total_spent = sub.revenue
            FROM (
                SELECT customer_id,
                       count(*) AS ord_count,
                       COALESCE(SUM(total), 0)::BIGINT AS revenue
                FROM orders WHERE customer_id IS NOT NULL
                GROUP BY customer_id
            ) sub
            WHERE c.id = sub.customer_id
        """))
        await db.commit()

        print(f"\nDone: {len(cid_list)} customers, {len(product_ids)} products, "
              f"{len(variant_ids)} variants, {order_count} orders, {item_count} items")

    await engine.dispose()


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "backend-api"))

    from uuid import uuid4
    from sqlmodel import select

    from src.orm.base import BaseModel
    import src.orm.models  # noqa: F401
    from src.orm.models.category import Category
    from src.orm.models.order import Customer, CustomerAddress, Order, OrderItem
    from src.orm.models.product import Product, Variant

    asyncio.run(seed())
