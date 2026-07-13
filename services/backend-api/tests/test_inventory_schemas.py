from uuid import uuid4
from datetime import datetime, timezone

from src.orm.schemas.inventory import (
    InventoryItemCreateInput,
    InventoryItemPatchInput,
    InventoryItemResponse,
    InventoryVariantResponse,
    InventoryStatsResponse,
    PaginationMeta,
    InventoryListResponse,
)


def test_create_input_accepts_minimal():
    data = InventoryItemCreateInput(name="Widget", sku="WDG-001")
    assert data.name == "Widget"
    assert data.sku == "WDG-001"
    assert data.category is None
    assert data.supplier is None
    assert data.price is None
    assert data.stock == 0


def test_create_input_rejects_empty_name():
    import pydantic
    try:
        InventoryItemCreateInput(name="", sku="SKU")
        assert False, "Should have raised"
    except pydantic.ValidationError:
        pass


def test_create_input_rejects_empty_sku():
    import pydantic
    try:
        InventoryItemCreateInput(name="Widget", sku="")
        assert False, "Should have raised"
    except pydantic.ValidationError:
        pass


def test_create_input_accepts_all_fields():
    data = InventoryItemCreateInput(
        name="Widget Pro",
        sku="WDG-PRO",
        category="Electronics",
        supplier="Acme Corp",
        price=29.99,
        stock=100,
    )
    assert data.name == "Widget Pro"
    assert data.price == 29.99
    assert data.stock == 100


def test_patch_input_all_optional():
    data = InventoryItemPatchInput()
    assert data.name is None
    assert data.sku is None


def test_patch_input_partial():
    data = InventoryItemPatchInput(category="Updated")
    assert data.category == "Updated"
    assert data.name is None


def test_variant_response_from_attributes():
    now = datetime.now(timezone.utc)
    vid = uuid4()
    pid = uuid4()
    variant = InventoryVariantResponse(
        id=vid,
        item_id=pid,
        name="Widget",
        sku="WDG-001",
        price=19.99,
        stock=50,
        created_at=now,
        updated_at=now,
    )
    assert variant.id == vid
    assert variant.item_id == pid
    assert variant.price == 19.99


def test_item_response_has_all_fields():
    now = datetime.now(timezone.utc)
    tid = uuid4()
    iid = uuid4()
    vid = uuid4()
    variant = InventoryVariantResponse(
        id=vid, item_id=iid, name="Widget", sku="WDG-001",
        price=19.99, stock=50, created_at=now, updated_at=now,
    )
    item = InventoryItemResponse(
        id=iid, tenant_id=tid, sku="WDG-001", name="Widget",
        category="Goods", status="in_stock",
        total_stock=50, total_value=999.50,
        variants=[variant], created_at=now, updated_at=now,
    )
    assert item.id == iid
    assert item.tenant_id == tid
    assert item.status == "in_stock"
    assert len(item.variants) == 1


def test_stats_response():
    stats = InventoryStatsResponse(
        total_skus=10, total_value=5000.0,
        low_stock_count=2, out_of_stock_count=1, total_variants=10,
    )
    assert stats.total_skus == 10


def test_pagination_meta():
    meta = PaginationMeta(page=2, page_size=10, total=25, total_pages=3)
    assert meta.page == 2
    assert meta.total_pages == 3


def test_list_response():
    meta = PaginationMeta(page=1, page_size=10, total=0, total_pages=0)
    resp = InventoryListResponse(data=[], pagination=meta)
    assert resp.data == []
    assert resp.pagination.total == 0
