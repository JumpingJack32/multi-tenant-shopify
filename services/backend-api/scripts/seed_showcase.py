"""Seed a flagship showcase catalog with premium products, variants, images, and stock.

Usage:
    doppler run -- uv run python scripts/seed_showcase.py
"""

import asyncio
import json
import os
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine

PRODUCTS = [
    {
        "name": "Double-Breasted Wool Trench Coat",
        "slug": "double-breasted-wool-trench-coat",
        "description": "A timeless double-breasted trench coat crafted from Italian virgin wool. Features a relaxed silhouette with a self-belt, raglan sleeves, and a storm flap. Fully lined in cupro.",
        "price": 29900,
        "variants": [
            {"sku": "TR-001-BLK-6", "options": {"Color": "Black", "Size": "6"}, "stock": 15},
            {"sku": "TR-001-BLK-8", "options": {"Color": "Black", "Size": "8"}, "stock": 20},
            {"sku": "TR-001-BLK-10", "options": {"Color": "Black", "Size": "10"}, "stock": 12},
            {"sku": "TR-001-CML-6", "options": {"Color": "Camel", "Size": "6"}, "stock": 10},
            {"sku": "TR-001-CML-8", "options": {"Color": "Camel", "Size": "8"}, "stock": 18},
            {"sku": "TR-001-CML-10", "options": {"Color": "Camel", "Size": "10"}, "stock": 8},
            {"sku": "TR001-NAV-8", "options": {"Color": "Navy", "Size": "8"}, "stock": 14},
        ],
        "category": "Coats & Jackets",
        "images": [
            "https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=800",
            "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800",
        ],
    },
    {
        "name": "Merino Wool Rollneck Jumper",
        "slug": "merino-wool-rollneck-jumper",
        "description": "A fine-gauge merino wool rollneck jumper. Lightweight yet insulating, with ribbed cuffs and hem. Perfect for layering under a blazer or coat.",
        "price": 12900,
        "variants": [
            {"sku": "MW-001-BLK-S", "options": {"Color": "Black", "Size": "S"}, "stock": 25},
            {"sku": "MW-001-BLK-M", "options": {"Color": "Black", "Size": "M"}, "stock": 30},
            {"sku": "MW-001-BLK-L", "options": {"Color": "Black", "Size": "L"}, "stock": 22},
            {"sku": "MW-001-CRM-S", "options": {"Color": "Cream", "Size": "S"}, "stock": 18},
            {"sku": "MW-001-CRM-M", "options": {"Color": "Cream", "Size": "M"}, "stock": 28},
            {"sku": "MW-001-CRM-L", "options": {"Color": "Cream", "Size": "L"}, "stock": 15},
            {"sku": "MW-001-CHR-M", "options": {"Color": "Charcoal", "Size": "M"}, "stock": 20},
        ],
        "category": "Knitwear",
        "images": [
            "https://images.unsplash.com/photo-1434389677669-e08b4cda3a10?w=800",
            "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800",
        ],
    },
    {
        "name": "Italian Leather Crossbody Bag",
        "slug": "italian-leather-crossbody-bag",
        "description": "A small crossbody bag in pebbled Italian leather. Adjustable strap, magnetic closure, interior zip pocket. Available in three colours.",
        "price": 24500,
        "variants": [
            {"sku": "BG-001-TAN", "options": {"Color": "Tan"}, "stock": 20},
            {"sku": "BG-001-BLK", "options": {"Color": "Black"}, "stock": 25},
            {"sku": "BG-001-BRN", "options": {"Color": "Brown"}, "stock": 15},
        ],
        "category": "Bags",
        "images": [
            "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800",
            "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800",
        ],
    },
    {
        "name": "Classic Leather Chelsea Boots",
        "slug": "classic-leather-chelsea-boots",
        "description": "Handcrafted Chelsea boots in polished calf leather. Elastic side panels, pull tab, leather sole with rubber grip. Goodyear welted for resoling.",
        "price": 39500,
        "variants": [
            {"sku": "CB-001-BLK-7", "options": {"Color": "Black", "Size": "7"}, "stock": 12},
            {"sku": "CB-001-BLK-8", "options": {"Color": "Black", "Size": "8"}, "stock": 18},
            {"sku": "CB-001-BLK-9", "options": {"Color": "Black", "Size": "9"}, "stock": 15},
            {"sku": "CB-001-BLK-10", "options": {"Color": "Black", "Size": "10"}, "stock": 10},
            {"sku": "CB-001-BRN-8", "options": {"Color": "Brown", "Size": "8"}, "stock": 14},
            {"sku": "CB-001-BRN-9", "options": {"Color": "Brown", "Size": "9"}, "stock": 12},
        ],
        "category": "Shoes",
        "images": [
            "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800",
            "https://images.unsplash.com/photo-1560769629-97543794f0f1?w=800",
        ],
    },
    {
        "name": "Silk Cashmere Scarf",
        "slug": "silk-cashmere-scarf",
        "description": "A lightweight scarf in a silk-cashmere blend. Hand-rolled edges, subtle herringbone weave. Generous 180cm length for multiple styling options.",
        "price": 8500,
        "variants": [
            {"sku": "SC-001-BLK", "options": {"Color": "Black"}, "stock": 35},
            {"sku": "SC-001-BRG", "options": {"Color": "Burgundy"}, "stock": 20},
            {"sku": "SC-001-NVY", "options": {"Color": "Navy"}, "stock": 25},
            {"sku": "SC-001-CRM", "options": {"Color": "Cream"}, "stock": 30},
        ],
        "category": "Accessories",
        "images": [
            "https://images.unsplash.com/photo-1601924994987-69e26d50f515?w=800",
            "https://images.unsplash.com/photo-1520903920243-00d972aab78f?w=800",
        ],
    },
]

CATEGORIES = [
    {"name": "Coats & Jackets", "slug": "coats-jackets"},
    {"name": "Knitwear", "slug": "knitwear"},
    {"name": "Bags", "slug": "bags"},
    {"name": "Shoes", "slug": "shoes"},
    {"name": "Accessories", "slug": "accessories"},
]

TENANT_SLUG = "showcase"


async def seed() -> None:
    print("Seeding showcase catalog...")
    async with AsyncSession(async_engine) as session:
        async with session.begin():
            # Find or create tenant
            tenant = (
                await session.execute(
                    text("SELECT id, tenant_id FROM tenants WHERE slug = :slug"),
                    {"slug": TENANT_SLUG},
                )
            ).first()

            if not tenant:
                tid = uuid.uuid4()
                now = datetime.now(timezone.utc)
                await session.execute(
                    text("""
                        INSERT INTO tenants (id, tenant_id, name, slug, plan, status, settings, options, created_at, updated_at)
                        VALUES (:id, :tid, 'Maison', :slug, 'enterprise', 'ACTIVE', :settings, '{}'::jsonb, NOW(), NOW())
                    """),
                    {"id": uuid.uuid4(), "tid": tid, "slug": TENANT_SLUG, "settings": json.dumps({"currency": "GBP"})},
                )
                tenant_id = tid
                print(f"  Created tenant '{TENANT_SLUG}' with tenant_id={tid}")
            else:
                tenant_id = tenant.tenant_id
                print(f"  Using existing tenant '{TENANT_SLUG}' tenant_id={tenant_id}")

            # Create categories
            cat_map = {}
            for cat in CATEGORIES:
                cid = uuid.uuid4()
                await session.execute(
                    text("""
                        INSERT INTO categories (id, tenant_id, name, slug, sort_order, is_active, created_at, updated_at)
                        VALUES (:id, :tid, :name, :slug, 0, true, NOW(), NOW())
                    """),
                    {"id": cid, "tid": tenant_id, "name": cat["name"], "slug": cat["slug"]},
                )
                cat_map[cat["slug"]] = cid

            # Create products
            for p in PRODUCTS:
                pid = uuid.uuid4()
                cat_id = cat_map.get(p["category"].lower().replace(" & ", "-").replace(" ", "-"))
                await session.execute(
                    text("""
                        INSERT INTO products (id, tenant_id, name, slug, description, status, is_active, category_id, weight_unit, avg_rating, review_count, created_at, updated_at)
                        VALUES (:id, :tid, :name, :slug, :desc, 'PUBLISHED', true, :cid, 'kg', 0, 0, NOW(), NOW())
                    """),
                    {"id": pid, "tid": tenant_id, "name": p["name"], "slug": p["slug"], "desc": p["description"], "cid": cat_id},
                )

                # Variants
                for v in p["variants"]:
                    vid = uuid.uuid4()
                    await session.execute(
                        text("""
                            INSERT INTO variants (id, tenant_id, product_id, sku, price, inventory_quantity, is_active, options, weight_unit, created_at, updated_at)
                            VALUES (:id, :tid, :pid, :sku, :price, :stock, true, :opts, 'kg', NOW(), NOW())
                        """),
                        {"id": vid, "tid": tenant_id, "pid": pid, "sku": v["sku"], "price": p["price"], "stock": v["stock"], "opts": json.dumps(v["options"])},
                    )

                    # Stock in main warehouse
                    node = (
                        await session.execute(
                            text("SELECT id FROM inventory_nodes WHERE tenant_id = :tid AND name = 'Main Warehouse' LIMIT 1"),
                            {"tid": tenant_id},
                        )
                    ).first()
                    if node:
                        await session.execute(
                            text("""
                                INSERT INTO inventory_stocks (id, tenant_id, variant_id, node_id, quantity, reserved, created_at, updated_at)
                                VALUES (:id, :tid, :vid, :nid, :qty, 0, NOW(), NOW())
                                ON CONFLICT (variant_id, node_id) DO UPDATE SET quantity = EXCLUDED.quantity
                            """),
                            {"id": uuid.uuid4(), "tid": tenant_id, "vid": vid, "nid": node.id, "qty": v["stock"]},
                        )

                print(f"  Created product: {p['name']}")

    print(f"\nShowcase catalog seeded successfully under tenant '{TENANT_SLUG}'!")


if __name__ == "__main__":
    asyncio.run(seed())
