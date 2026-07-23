"""Seed navigation menus for all tenants."""

from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

NAV_STRUCTURE = {
    "women": {
        "title": "Women",
        "children": [
            {"title": "Latest", "href": "/women/latest", "is_title_link": True, "children": [
                {"title": "New", "href": "/women/latest/new"},
                {"title": "Summer Styles", "href": "/women/latest/summer-styles"},
                {"title": "Classics", "href": "/women/latest/classics"},
            ]},
            {"title": "A Good Sport", "href": "/women/a-good-sport", "is_title_link": True, "is_featured": True},
            {"title": "Coats & Jackets", "href": "/women/coats-jackets", "show_view_all": True, "children": [
                {"title": "Coats", "href": "/women/coats-jackets/coats"},
                {"title": "Jackets", "href": "/women/coats-jackets/jackets"},
                {"title": "Trench Coats", "href": "/women/coats-jackets/trench-coats"},
                {"title": "Quilted Jackets", "href": "/women/coats-jackets/quilted-jackets"},
                {"title": "Puffer Jackets", "href": "/women/coats-jackets/puffer-jackets"},
                {"title": "Ponchos & Capes", "href": "/women/coats-jackets/ponchos-capes"},
            ]},
            {"title": "Clothes", "href": "/women/clothes", "show_view_all": True, "children": [
                {"title": "Coats & Jackets", "href": "/women/clothes/coats-jackets"},
                {"title": "Knitwear", "href": "/women/clothes/knitwear"},
                {"title": "Polos & T-shirts", "href": "/women/clothes/polos-t-shirts"},
                {"title": "Shirts & Tops", "href": "/women/clothes/shirts-tops"},
                {"title": "Dresses", "href": "/women/clothes/dresses"},
                {"title": "Skirts", "href": "/women/clothes/skirts"},
                {"title": "Hoodies & Sweatshirts", "href": "/women/clothes/hoodies-sweatshirts"},
                {"title": "Blazers & Tailoring", "href": "/women/clothes/blazers-tailoring"},
                {"title": "Trousers & Shorts", "href": "/women/clothes/trousers-shorts"},
                {"title": "Activewear", "href": "/women/clothes/activewear"},
                {"title": "Denim", "href": "/women/clothes/denim"},
                {"title": "Swimwear", "href": "/women/clothes/swimwear"},
            ]},
            {"title": "Bags", "href": "/women/bags", "show_view_all": True, "children": [
                {"title": "Mini Bags", "href": "/women/bags/mini-bags"},
                {"title": "Tote Bags", "href": "/women/bags/tote-bags"},
                {"title": "Crossbody Bags", "href": "/women/bags/crossbody-bags"},
                {"title": "Shoulder Bags", "href": "/women/bags/shoulder-bags"},
                {"title": "Top Handle Bags", "href": "/women/bags/top-handle-bags"},
                {"title": "Backpacks", "href": "/women/bags/backpacks"},
            ]},
            {"title": "Shoes", "href": "/women/shoes", "show_view_all": True, "children": [
                {"title": "Sneakers", "href": "/women/shoes/sneakers"},
                {"title": "Sandals", "href": "/women/shoes/sandals"},
                {"title": "Loafers & Ballerinas", "href": "/women/shoes/loafers-ballerinas"},
                {"title": "Boots", "href": "/women/shoes/boots"},
                {"title": "Pumps", "href": "/women/shoes/pumps"},
            ]},
            {"title": "Accessories", "href": "/women/accessories", "show_view_all": True, "children": [
                {"title": "Scarves", "href": "/women/accessories/scarves"},
                {"title": "Belts", "href": "/women/accessories/belts"},
                {"title": "Sunglasses", "href": "/women/accessories/sunglasses"},
                {"title": "Caps & Bucket Hats", "href": "/women/accessories/caps-bucket-hats"},
                {"title": "Wallets & Card Cases", "href": "/women/accessories/wallets-card-cases"},
                {"title": "Umbrellas", "href": "/women/accessories/umbrellas"},
                {"title": "Jewellery", "href": "/women/accessories/jewellery"},
                {"title": "Home", "href": "/women/accessories/home"},
                {"title": "Socks & Tights", "href": "/women/accessories/socks-tights"},
                {"title": "Tech & Travel", "href": "/women/accessories/tech-travel"},
                {"title": "Key & Bag Charms", "href": "/women/accessories/key-bag-charms"},
            ]},
            {"title": "Wallets & Card Cases", "href": "/women/wallets-card-cases", "show_view_all": True, "children": [
                {"title": "Card Cases", "href": "/women/wallets-card-cases/card-cases"},
                {"title": "Long Wallets", "href": "/women/wallets-card-cases/long-wallets"},
                {"title": "Compact Wallets", "href": "/women/wallets-card-cases/compact-wallets"},
                {"title": "Chain Strap Wallets", "href": "/women/wallets-card-cases/chain-strap-wallets"},
            ]},
            {"title": "Gifts", "href": "/women/gifts", "show_view_all": True, "children": [
                {"title": "Fragrance", "href": "/women/gifts/fragrance"},
                {"title": "Personalised Gifts", "href": "/women/gifts/personalised-gifts"},
                {"title": "Personalised Scarves", "href": "/women/gifts/personalised-scarves"},
                {"title": "Burberry Classics", "href": "/women/gifts/burberry-classics"},
            ]},
        ],
    },
    "top_level": [
        {"title": "Men", "href": "/men"},
        {"title": "Children", "href": "/children"},
        {"title": "Gifts", "href": "/gifts"},
        {"title": "Trench", "href": "/trench"},
        {"title": "Scarves", "href": "/scarves"},
        {"title": "Bags", "href": "/bags"},
        {"title": "Beauty", "href": "/beauty"},
    ],
}


async def _insert_items(
    session: AsyncSession,
    menu_id: str,
    tenant_id: str,
    items: list[dict],
    parent_id: str | None = None,
    sort_start: int = 0,
) -> None:
    for i, item in enumerate(items):
        item_id = str(uuid4())
        children = item.pop("children", [])
        await session.execute(
            text("""
                INSERT INTO navigation_items (
                    id, tenant_id, menu_id, parent_id,
                    title, type, href, sort_order,
                    is_title_link, show_view_all, is_featured,
                    created_at, updated_at
                ) VALUES (
                    :id, :tid, :menu_id, :parent_id,
                    :title, :type, :href, :sort_order,
                    :is_title_link, :show_view_all, :is_featured,
                    NOW(), NOW()
                )
            """),
            {
                "id": item_id,
                "tid": tenant_id,
                "menu_id": menu_id,
                "parent_id": parent_id,
                "title": item.get("title", ""),
                "type": "editorial",
                "href": item.get("href"),
                "sort_order": sort_start + i,
                "is_title_link": item.get("is_title_link", False),
                "show_view_all": item.get("show_view_all", False),
                "is_featured": item.get("is_featured", False),
            },
        )
        if children:
            await _insert_items(session, menu_id, tenant_id, children, item_id)


async def seed_navigation(session: AsyncSession, tenants_by_slug: dict[str, dict]) -> None:
    for slug, tdata in tenants_by_slug.items():
        tenant_id = str(tdata["id"])

        menu_id = str(uuid4())
        await session.execute(
            text("""
                INSERT INTO navigation_menus (id, tenant_id, slug, title, created_at, updated_at)
                VALUES (:id, :tid, 'main', 'Primary Navigation', NOW(), NOW())
            """),
            {"id": menu_id, "tid": tenant_id},
        )

        women = NAV_STRUCTURE["women"]
        await _insert_items(session, menu_id, tenant_id, [women], sort_start=0)

        top_level = NAV_STRUCTURE["top_level"]
        await _insert_items(session, menu_id, tenant_id, top_level, sort_start=10)

    print(f"Navigation menus seeded for {len(tenants_by_slug)} tenants")
