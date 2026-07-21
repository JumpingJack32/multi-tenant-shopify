from uuid import uuid4

from httpx import ASGITransport, AsyncClient
import pytest
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.database import async_engine
from src.main import app
from src.orm.base import BaseModel
from src.orm.models.category import Category
from src.orm.models.order import Customer, Order, OrderItem, OrderStatus, PaymentStatus
from src.orm.models.product import Product, Variant


@pytest.fixture(autouse=True)
async def setup_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    async with AsyncSession(async_engine) as db:
        await db.exec(delete(OrderItem))
        await db.exec(delete(Order))
        await db.exec(delete(Variant))
        await db.exec(delete(Product))
        await db.exec(delete(Category))
        await db.exec(delete(Customer))
        await db.commit()


@pytest.fixture
def tenant_a():
    return uuid4()


@pytest.fixture
def tenant_b():
    return uuid4()


@pytest.fixture
async def client(tenant_a):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        ac.headers["X-Tenant-ID"] = str(tenant_a)
        yield ac


@pytest.fixture
async def seed_data(tenant_a, tenant_b):
    """Seed orders with items for two tenants, including cancelled/refunded."""
    async with AsyncSession(async_engine) as db:
        cat = Category(id=uuid4(), tenant_id=tenant_a, name="Bags", slug="bags", is_active=True)
        db.add(cat)

        products = []
        variants = []
        for name, price in [("Rucksack", 5000), ("Tote", 3000)]:
            p = Product(id=uuid4(), tenant_id=tenant_a, name=name, slug=name.lower(), is_active=True, category_id=cat.id)
            db.add(p)
            await db.flush()
            products.append(p)
            v = Variant(id=uuid4(), tenant_id=tenant_a, product_id=p.id, sku=f"SKU-{name.upper()}", price=price, inventory_quantity=10, is_active=True)
            db.add(v)
            await db.flush()
            variants.append(v)

        # Tenant B product (no category)
        bp = Product(id=uuid4(), tenant_id=tenant_b, name="Alien Tech", slug="alien-tech", is_active=True)
        db.add(bp)
        await db.flush()
        bv = Variant(id=uuid4(), tenant_id=tenant_b, product_id=bp.id, sku="SKU-ALIEN", price=9999, inventory_quantity=5, is_active=True)
        db.add(bv)

        customer = Customer(id=uuid4(), tenant_id=tenant_a, email="buyer@a.com", email_subscription_status="subscribed")
        db.add(customer)

        # Active order (counted)
        o1 = Order(
            id=uuid4(), tenant_id=tenant_a, customer_id=customer.id, customer_email="buyer@a.com",
            order_number="ORD-001", status=OrderStatus.PAID, payment_status=PaymentStatus.PAID,
            total=8000, currency="GBP", base_currency="GBP",
        )
        db.add(o1)
        v0_id = variants[0].id
        v1_id = variants[1].id
        p0_id = products[0].id
        p1_id = products[1].id
        db.add(OrderItem(id=uuid4(), order_id=o1.id, tenant_id=tenant_a, variant_id=v0_id, product_id=p0_id,
                         product_name="Rucksack", sku="SKU-RUCKSACK", quantity=1, unit_price=5000, total_price=5000))
        db.add(OrderItem(id=uuid4(), order_id=o1.id, tenant_id=tenant_a, variant_id=v1_id, product_id=p1_id,
                         product_name="Tote", sku="SKU-TOTE", quantity=1, unit_price=3000, total_price=3000))

        # Cancelled order (excluded)
        o2 = Order(
            id=uuid4(), tenant_id=tenant_a, customer_id=customer.id, customer_email="buyer@a.com",
            order_number="ORD-002", status=OrderStatus.CANCELLED, payment_status=PaymentStatus.PAID,
            total=5000, currency="GBP", base_currency="GBP",
        )
        db.add(o2)
        db.add(OrderItem(id=uuid4(), order_id=o2.id, tenant_id=tenant_a, variant_id=v0_id, product_id=p0_id,
                         product_name="Rucksack", sku="SKU-RUCKSACK", quantity=2, unit_price=5000, total_price=10000))

        # Tenant B order (isolated)
        o3 = Order(
            id=uuid4(), tenant_id=tenant_b, order_number="ORD-B01", status=OrderStatus.PAID,
            payment_status=PaymentStatus.PAID, total=9999, currency="GBP", base_currency="GBP",
        )
        db.add(o3)
        db.add(OrderItem(id=uuid4(), order_id=o3.id, tenant_id=tenant_b, variant_id=bv.id, product_id=bp.id,
                         product_name="Alien Tech", sku="SKU-ALIEN", quantity=1, unit_price=9999, total_price=9999))

        await db.flush()

        await db.commit()


@pytest.mark.anyio
async def test_top_products_tenant_isolation(client: AsyncClient, seed_data):
    """Tenant A should not see Tenant B's products."""
    response = await client.get("/api/v1/analytics/top-products?limit=10")
    assert response.status_code == 200
    data = response.json()
    names = [d["product_name"] for d in data]
    assert "Rucksack" in names
    assert "Tote" in names
    assert "Alien Tech" not in names


@pytest.mark.anyio
async def test_top_products_excludes_cancelled(client: AsyncClient, seed_data):
    """Cancelled order items should not count toward units_sold or total_revenue."""
    response = await client.get("/api/v1/analytics/top-products?limit=10&sort_by=revenue")
    assert response.status_code == 200
    data = response.json()
    rucksack = next(d for d in data if d["product_name"] == "Rucksack")
    # Only the 1 unit from the PAID order, not the 2 units from CANCELLED
    assert rucksack["units_sold"] == 1
    assert rucksack["total_revenue"] == 5000


@pytest.mark.anyio
async def test_top_products_empty_date_range(client: AsyncClient, seed_data):
    """Date range with no orders should return empty list."""
    response = await client.get("/api/v1/analytics/top-products?start_date=2020-01-01&end_date=2020-01-02")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.anyio
async def test_category_breakdown_tenant_isolation(client: AsyncClient, seed_data):
    """Tenant A categories should not include Tenant B data."""
    response = await client.get("/api/v1/analytics/category-breakdown")
    assert response.status_code == 200
    data = response.json()
    names = [d["category_name"] for d in data]
    assert "Bags" in names or "Uncategorized" in names
    assert all(d["units_sold"] > 0 for d in data)


@pytest.mark.anyio
async def test_category_breakdown_excludes_cancelled(client: AsyncClient, seed_data):
    """Cancelled order revenue should not appear in category totals."""
    response = await client.get("/api/v1/analytics/category-breakdown")
    assert response.status_code == 200
    data = response.json()
    total_rev = sum(d["total_revenue"] for d in data)
    # Only 5000 (Rucksack) + 3000 (Tote) = 8000, not including cancelled 10000
    assert total_rev == 8000


@pytest.mark.anyio
async def test_category_breakdown_empty_date_range(client: AsyncClient, seed_data):
    """Empty date range should return empty list (no ZeroDivisionError)."""
    response = await client.get("/api/v1/analytics/category-breakdown?start_date=2020-01-01&end_date=2020-01-02")
    assert response.status_code == 200
    assert response.json() == []
