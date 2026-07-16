# Purchase Order System — Design Spec

**Date:** 2026-07-10
**Branch:** `feat/purchase-order-system`
**Status:** Draft — pending review

## Problem

Multi-tenant Shopify admin has Sales Orders (SOs) and Inventory tracking but no Purchase Order (PO) system. For B2B dropshipping, paid customer SOs need to generate POs to suppliers, with admin review, tracking, and lifecycle management.

Phase 1: pure dropshipping (customer address = ship-to). Phase 2 (hybrid warehouse + dropship) is deferred but the architecture must support it without rewrites.

## Design Overview

New relational domain (Suppliers, PurchaseOrders, PurchaseOrderItems) + fulfillment strategy routing layer. When a dropship SO is paid, a background operation generates a PO in `pending_review` state. Admin reviews via a queue under Products menu, approves/sends to supplier, tracks through to delivery.

---

## 1. Domain Models

### Suppliers Table

New table, FK from `Product`. Replaces the free-text `supplier` field.

```python
class Supplier(SQLModel, table=True):
    __tablename__ = "suppliers"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", nullable=False)
    name: str = Field(max_length=255, nullable=False)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: str = Field(default="manual_email", max_length=50)
    # "manual_email" — admin manually emails PO PDF
    # "api" — future automated submission
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})
```

### Migration: `supplier` on Product → FK

```python
# On Product model:
supplier_id: Optional[UUID] = Field(default=None, foreign_key="suppliers.id", nullable=True, sa_column_kwargs={"ondelete": "RESTRICT"})
# Drop the old `supplier: Optional[str]` column
```

Also add `cost_price` and `supplier_sku` to `Variant`:

```python
# On Variant model:
supplier_sku: Optional[str] = Field(default=None, max_length=255)
cost_price: Optional[int] = Field(default=None, ge=0)  # COGS in integer cents
```

### Purchase Orders Table

```python
class PurchaseOrder(SQLModel, table=True):
    __tablename__ = "purchase_orders"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", nullable=False)
    po_number: str = Field(max_length=50, nullable=False)  # auto-generated, e.g. "PO-20260710-0001"
    supplier_id: UUID = Field(foreign_key="suppliers.id", nullable=False, sa_column_kwargs={"ondelete": "RESTRICT"})
    status: str = Field(default="pending_review", max_length=50)
    # lifecycle: draft → pending_review → sent → confirmed → in_transit → closed
    #                                                              ↘ cancelled
    # dropshipping: in_transit → closed (no partial receive)
    # warehouse (phase 2): in_transit → partially_received → received → closed
    fulfillment_strategy: str = Field(default="dropship", max_length=50)
    # "dropship" — ship to customer address
    # "warehouse" — ship to warehouse (phase 2)
    ship_to_address_id: Optional[UUID] = Field(default=None, foreign_key="addresses.id")
    ship_to_address_snapshot: Optional[dict] = Field(default=None, sa_type=JSONB)
    # Frozen copy of the full address at PO creation time.
    # Prevents customer address edits from retroactively altering historical POs.
    # Structure: { "line1": ..., "line2": ..., "city": ..., "postal_code": ..., "country": ... }

    # Tracking (updated by admin or future webhook)
    tracking_number: Optional[str] = Field(default=None, max_length=255)
    carrier: Optional[str] = Field(default=None, max_length=100)

    # Financial
    subtotal: int = Field(default=0)  # in cents (sum of cost_price × qty)
    tax: int = Field(default=0)
    shipping_cost: int = Field(default=0)
    total: int = Field(default=0)

    notes: Optional[str] = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})
    sent_at: Optional[datetime] = Field(default=None)
    confirmed_at: Optional[datetime] = Field(default=None)
    closed_at: Optional[datetime] = Field(default=None)
```

### Purchase Order Items Table

```python
class PurchaseOrderItem(SQLModel, table=True):
    __tablename__ = "purchase_order_items"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    purchase_order_id: UUID = Field(foreign_key="purchase_orders.id", nullable=False)
    variant_id: UUID = Field(foreign_key="variants.id", nullable=False)
    supplier_sku: Optional[str] = Field(default=None, max_length=255)
    product_name: str = Field(max_length=255)   # denormalized snapshot
    variant_label: str = Field(default="", max_length=255)  # e.g. "Size M / Red"
    quantity: int = Field(..., ge=1)
    unit_cost: int = Field(..., ge=0)  # in cents (COGS at time of PO)
    subtotal: int = Field(default=0)   # quantity × unit_cost

    # Phase 2: warehouse receipt fields
    received_quantity: Optional[int] = Field(default=None, ge=0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
```

### Order Fulfillment Links Table (Polymorphic Junction)

Intersection table linking `order_items` (SO demand) to `purchase_order_items` (PO supply). Pure dropshipping writes rows here; warehouse replenishment (Phase 2) does not. No structural DB changes needed between phases.

```python
class OrderFulfillmentLink(SQLModel, table=True):
    __tablename__ = "order_fulfillment_links"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", nullable=False)
    order_item_id: UUID = Field(foreign_key="order_items.id", nullable=False, index=True)
    purchase_order_item_id: UUID = Field(foreign_key="purchase_order_items.id", nullable=False, index=True)
    quantity: int = Field(..., ge=1)  # how many units of the PO line serve this SO line

    created_at: datetime = Field(default_factory=datetime.utcnow)
```

This enables:

- **Traceability:** JOIN from SO line → link → PO line (and reverse), fully indexable
- **Split-fulfillment:** A single SO line can link to multiple PO items across different POs (e.g., supplier splits a shipment)
- **Multi-supplier coverage:** One customer order fulfilled by two different suppliers — each SO item links to its own PO item
- **Clean Phase 2:** Warehouse replenishment POs (no linked SO) simply have zero rows in this table — no NULLs, no leaky schema
- **Receipt reconciliation:** When PO is marked `in_transit` → `closed`, a simple JOIN finds all linked SO items to auto-update their fulfillment status

### Fulfillment Strategy Routing Layer

A thin dispatch module that decides what happens when an SO line item is ready for fulfillment:

```python
# src/services/fulfillment_router.py

class FulfillmentStrategy(str, enum.Enum):
    DROPSHIP = "dropship"
    WAREHOUSE = "warehouse"  # Phase 2

async def route_fulfillment(
    order_item: OrderItem,
    variant: Variant,
    tenant_id: UUID,
    db: AsyncSession,
) -> UUID:  # returns the PO id
    """
    Determine fulfillment strategy for an order item and create appropriate
    fulfillment artifact (PO for dropship, pick-list for warehouse).
    """
```

**Phase 1** — `route_fulfillment` always returns `DROPSHIP`:

- Finds the product's supplier
- Creates `PurchaseOrder` + `PurchaseOrderItem` in `pending_review` state
- Inserts `OrderFulfillmentLink` row joining `order_item.id` → `purchase_order_item.id`

**Phase 2** — `route_fulfillment` checks:

- Variant has warehouse stock ≥ order quantity → `WAREHOUSE` (creates pick-list, decrements inventory)
- Variant has partial stock → split: warehouse fulfills what it can, PO covers the rest
- Variant has no stock → `DROPSHIP` (auto-generate PO)

This keeps SO and PO logic fully decoupled. The SO only calls `route_fulfillment`; it doesn't know about POs.

---

## 2. State Machine

```
                         ┌──────────┐
                         │  draft    │  (manual PO creation — phase 2)
                         └─────┬─────┘
                               │
                         ┌─────▼──────────┐
                    ┌────│  pending_review │  (auto-generated from paid SO)
                    │    └─────┬──────────┘
                    │          │ admin clicks "Approve & Send"
              ┌─────▼──┐      │
              │cancelled│  ┌──▼────┐
              └────────┘  │ sent   │  (PO transmitted to supplier)
                          └──┬─────┘
                             │ supplier acknowledges
                          ┌──▼─────────┐
                          │  confirmed  │
                          └──┬──────────┘
                             │ supplier ships
                          ┌──▼──────────┐
                          │  in_transit  │  (tracking number added)
                          └──┬──────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
       ┌────────▼──────┐    │   ┌────────▼─────────┐
       │ [dropship]    │    │   │ [warehouse — ph2] │
       │ closed        │    │   │ partially_received │
       └────────────────┘    │   └────────┬──────────┘
                             │            │ final box received
                             │   ┌────────▼─────────┐
                             │   │ received           │
                             │   └────────┬──────────┘
                             │            │
                      ┌──────▼────┐
                      │  closed   │
                      └───────────┘
```

### State transitions

| From                 | To                   | Trigger                                                                   |
| -------------------- | -------------------- | ------------------------------------------------------------------------- |
| `draft`              | `pending_review`     | Save-for-review                                                           |
| `draft`              | `cancelled`          | Manual cancel                                                             |
| `pending_review`     | `sent`               | Admin "Approve & Send"                                                    |
| `pending_review`     | `cancelled`          | Admin rejects                                                             |
| `sent`               | `confirmed`          | Supplier acknowledgment (manual)                                          |
| `sent`               | `cancelled`          | Supplier rejects / admin cancels                                          |
| `confirmed`          | `in_transit`         | Tracking number entered                                                   |
| `in_transit`         | `closed`             | Delivery confirmed (dropship: customer delivery; warehouse: all received) |
| `in_transit`         | `partially_received` | Warehouse counts partial boxes (phase 2)                                  |
| `partially_received` | `received`           | Remaining boxes arrive (phase 2)                                          |
| `received`           | `closed`             | Invoice paid (phase 2)                                                    |

---

## 3. Endpoint Contract

### Suppliers CRUD

| Method   | Path                     | Purpose                              |
| -------- | ------------------------ | ------------------------------------ |
| `GET`    | `/api/v1/suppliers`      | List (tenant-scoped)                 |
| `POST`   | `/api/v1/suppliers`      | Create                               |
| `GET`    | `/api/v1/suppliers/{id}` | Get single                           |
| `PATCH`  | `/api/v1/suppliers/{id}` | Update                               |
| `DELETE` | `/api/v1/suppliers/{id}` | Delete (fails if linked to products) |

### Purchase Orders CRUD

| Method  | Path                                   | Purpose                                          |
| ------- | -------------------------------------- | ------------------------------------------------ |
| `GET`   | `/api/v1/purchase-orders`              | List with filters (status, supplier, date range) |
| `GET`   | `/api/v1/purchase-orders/pending`      | Queue: POs in `pending_review` + `draft`         |
| `GET`   | `/api/v1/purchase-orders/{id}`         | Single PO with line items                        |
| `POST`  | `/api/v1/purchase-orders`              | Manual create (phase 2 — not built yet)          |
| `PATCH` | `/api/v1/purchase-orders/{id}`         | Update status, tracking, notes                   |
| `POST`  | `/api/v1/purchase-orders/{id}/approve` | Transition: `pending_review` → `sent`            |
| `POST`  | `/api/v1/purchase-orders/{id}/cancel`  | Transition: any → `cancelled`                    |

### Dashboard

Add to existing `GET /api/v1/admin/dashboard/summary`:

```json
{
  "pending_po_count": 3,
  "pending_po_total": 45000
}
```

---

## 4. Pydantic Schemas

### Response Schemas

```python
class SupplierResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    delivery_method: str
    product_count: int = 0  # computed
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderItemResponse(BaseModel):
    id: UUID
    variant_id: UUID
    supplier_sku: Optional[str] = None
    product_name: str
    variant_label: str
    quantity: int
    unit_cost: int
    subtotal: int
    received_quantity: Optional[int] = None

class PurchaseOrderResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    po_number: str
    supplier_id: UUID
    supplier_name: str  # denormalized from join
    status: str
    fulfillment_strategy: str
    ship_to_address: Optional[AddressResponse] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    subtotal: int
    tax: int
    shipping_cost: int
    total: int
    source_order_number: Optional[str] = None  # resolved via order_fulfillment_links join
    items: list[PurchaseOrderItemResponse]
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sent_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderListResponse(BaseModel):
    data: list[PurchaseOrderResponse]
    pagination: PaginationMeta
```

### Input Schemas

```python
class SupplierCreateInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: str = Field(default="manual_email")

class SupplierPatchInput(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    contact_email: Optional[str] = Field(default=None, max_length=255)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    delivery_method: Optional[str] = Field(default=None)

class PurchaseOrderPatchInput(BaseModel):
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    notes: Optional[str] = None
```

---

## 5. PO Auto-Generation Flow (Phase 1)

Triggered when a Sales Order transitions to `paid`:

```
1. SO status changes to "paid"
       │
2. For each OrderItem in SO:
       │
3. route_fulfillment(order_item)
       │
4. Lookup: Product.variant_id → Product.supplier_id
   (All items from same supplier should group into one PO)
       │
5. Group OrderItems by supplier_id
       │
6. Items with no supplier_id → skip PO generation entirely,
   flagged with a "not_sourced" annotation on the SO item
       │
7. For each supplier group:
       ├─ Create PurchaseOrder:
       │    tenant_id = SO.tenant_id
       │    supplier_id = matched supplier
       │    po_number = auto-generate (PO-YYYYMMDD-NNNN-RAND)
       │    status = "pending_review"
       │    fulfillment_strategy = "dropship"
       │    ship_to_address_id = SO.shipping_address_id
       │
       └─ For each OrderItem in group:
            ├─ Create PurchaseOrderItem:
            │    variant_id = order_item.variant_id
            │    supplier_sku = variant.supplier_sku
            │    product_name = variant.product.name
            │    quantity = order_item.quantity
            │    unit_cost = variant.cost_price
            │
            └─ Insert OrderFulfillmentLink:
                 order_item_id = order_item.id
                 purchase_order_item_id = (created above)
                 quantity = order_item.quantity
```

### Implementation: Direct route handler (no service layer)

Following existing pattern, the auto-generation lives directly in the route handler for the SO status transition endpoint. Alternatively, a small background task via `asyncio.create_task` so the SO `PATCH` response isn't blocked.

**Decision:** Keep in-request for now (low volume); extract to background worker if latency becomes an issue.

---

## 6. Admin Frontend

### Navigation

Purchase Orders and Suppliers live under the Products menu (sourcing & procurement lives with catalog). Sales Orders remain under the Orders menu (customer revenue) — entirely separate workflow.

```
Products                      Orders
├─ Products                   └─ Sales Orders
├─ Inventory
├─ Purchase Orders (new)
└─ Suppliers (new)
```

### Purchase Orders List Page

`/products/purchase-orders` or `/purchase-orders`

Features:

- Table: PO Number, Supplier, Status (colored badge), Total, Items count, Created
- Filter by status, supplier, date range
- "Pending Review" tab (default view — shows `pending_review` + `draft`)
- Click row → detail page

### Purchase Order Detail Page

`/purchase-orders/{id}`

Sections:

- **Header:** PO Number, Status badge, Supplier name
- **SO Reference:** Linked SOs resolved via `order_fulfillment_links` join (display SO number, link to SO detail)
- **Items Table:** Product, Variant, Supplier SKU, Qty, Unit Cost, Subtotal
- **Ship To:** Customer address (read-only)
- **Tracking:** Carrier + tracking number fields (editable)
- **Timeline:** Status history with dates
- **Actions:**
  - "Approve & Send" (if `pending_review` → `sent`)
  - "Mark as Confirmed" (if `sent` → `confirmed`)
  - "Add Tracking" (if `confirmed` → `in_transit`)
  - "Mark as Delivered" (if `in_transit` → `closed`)
  - "Cancel" (any → `cancelled`)

### Suppliers List Page

`/products/suppliers`

Simple CRUD table: Name, Email, Delivery Method, # Products linked, Actions (Edit, Delete)

### Dashboard Card

Add "Pending POs" to the dashboard showing count + total value.

---

## 7. DB Schema Changes (Summary)

| Change                                         | Migration                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Create `suppliers` table                       | New                                                                |
| Add `supplier_id` FK to `products`             | Drop old `supplier` text column, add FK                            |
| Add `supplier_sku`, `cost_price` to `variants` | New columns                                                        |
| Create `purchase_orders` table                 | New                                                                |
| Create `purchase_order_items` table            | New                                                                |
| Create `order_fulfillment_links` table         | New — polymorphic junction: `order_items` ↔ `purchase_order_items` |

---

## 8. Testing Strategy

### File: `tests/test_purchase_orders.py`

**Pattern:** Async `httpx.AsyncClient` with `ASGITransport`. Seeded DB with supplier, product, variant.

### Test Matrix

| #   | Test                                 | Validates                                                             |
| --- | ------------------------------------ | --------------------------------------------------------------------- |
| 1   | `test_create_supplier`               | POST supplier → 201 + fields match                                    |
| 2   | `test_list_suppliers`                | Empty → `[]`; seeded → correct count                                  |
| 3   | `test_supplier_tenant_isolation`     | Tenant A creates → Tenant B doesn't see                               |
| 4   | `test_delete_supplier_with_products` | 409 when products linked                                              |
| 5   | `test_create_po_manual`              | Direct POST → creates PO + items                                      |
| 6   | `test_po_lifecycle`                  | pending_review → sent → confirmed → in_transit → closed               |
| 7   | `test_po_cancel`                     | pending_review → cancelled                                            |
| 8   | `test_auto_generate_from_so`         | Create paid SO → PO auto-created in pending_review                    |
| 9   | `test_po_supplier_grouping`          | 2 items, same supplier → 1 PO with 2 items                            |
| 10  | `test_po_no_supplier`                | SO item with no supplier → handled gracefully                         |
| 11  | `test_po_list_filters`               | Filter by status, supplier, date range                                |
| 12  | `test_po_tracking_update`            | PATCH tracking_number + carrier → reflected                           |
| 13  | `test_po_dashboard_kpi`              | Pending POs count + total in dashboard summary                        |
| 14  | `test_multi_supplier_split_order`    | 3 items (2 suppliers + 1 no-supplier) → 2 POs created, 1 item skipped |
| 15  | `test_address_frozen_on_creation`    | Edit source address after PO creation → PO snapshot unchanged         |
| 16  | `test_po_number_race_safety`         | Concurrent PO creation → unique po_number for each                    |
| 17  | `test_delete_supplier_with_po`       | 409 when supplier has historical POs (RESTRICT cascade)               |

---

## 9. Phase 2 Preparation (Deferred, Architected For)

These are designed for but not implemented:

| Feature                                  | What changes                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| `FulfillmentStrategy.WAREHOUSE`          | New branch in `route_fulfillment` — creates pick-list, decrements inventory                |
| `partially_received` / `received` states | Unlocked in state machine, warehouse UI for receipt                                        |
| Hybrid split-fulfillment                 | Single SO item → warehouse stock allocation + remainder PO                                 |
| Supplier API integration                 | `delivery_method = "api"` triggers HTTP call instead of manual email                       |
| Purchase Order PDF generation            | Template + download endpoint                                                               |
| Supplier portal                          | External-facing supplier login to confirm/ship POs                                         |
| `order_fulfillment_links`                | Already present from Phase 1 — zero-change for Phase 2 (warehouse POs simply have no rows) |

---

## Resolved Decisions

| Question                     | Decision                                                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Suppliers table vs free-text | Structured `suppliers` table immediately                                                                         |
| PO trigger                   | Auto-generate as `pending_review`; admin approves via queue                                                      |
| SO↔PO linking                | Polymorphic junction table `order_fulfillment_links` — no direct FKs on PO tables                                |
| Lifecycle states             | `draft → pending_review → sent → confirmed → in_transit → closed`, `cancelled`                                   |
| Dropship vs warehouse states | Single status column; dropship skips `received` states                                                           |
| Service layer                | No — direct ORM in route handlers (follows existing pattern)                                                     |
| PO auto-generation           | In-request handler; extract to background task if latency issues                                                 |
| Frontend location            | Under Products menu: Purchase Orders + Suppliers                                                                 |
| Cost price type              | Integer cents on `Variant.cost_price` (not float) — consistent with all monetary fields                          |
| Supplier deletion guard      | `ondelete="RESTRICT"` on all `supplier_id` FKs — prevents deletion with linked records                           |
| Address mutability           | Frozen `ship_to_address_snapshot` JSONB on PO at creation — customer address edits don't retroactively alter POs |
| PO number race safety        | Sequence table with row-level `SELECT ... FOR UPDATE` lock + 4-char random alphanumeric suffix                   |
| Multi-supplier order         | Items grouped by supplier; items without supplier skipped with `not_sourced` flag on SO item                     |

## Implementation Notes

- **PO numbering:** Format `PO-YYYYMMDD-NNNN-RAND` where `NNNN` is a per-tenant daily sequential counter and `RAND` is a 4-char alphanumeric suffix. Counter stored in a `po_sequences` table with `SELECT ... FOR UPDATE` row lock to prevent races.
- **COGS snapshot:** `unit_cost` on `PurchaseOrderItem` captures cost at time of PO — changes to `Variant.cost_price` do NOT retroactively affect existing POs
- **Cost price in cents:** `cost_price` on Variant and all PO monetary fields use integer cents (matching existing `price` convention). `cost_price` is `int`, never `float`.
- **`supplier_id` on Product:** nullable with `ondelete="RESTRICT"` — existing products without a supplier won't auto-generate POs; deletion blocked if products exist
- **`PurchaseOrder.supplier_id`:** also `ondelete="RESTRICT"` — supplier cannot be deleted if they have historical POs
- **Dashboard KPI:** `pending_po_count` and `pending_po_total` added to existing dashboard summary endpoint response
- **Address freezing:** At PO creation, the full shipping address is copied from the SO's address into `ship_to_address_snapshot` (JSONB). The FK `ship_to_address_id` is preserved for live lookups, but the snapshot is the authoritative record for historical accuracy.
- **SO fulfillment sourcing status:** After auto-generation, the SO's fulfillment status must reflect whether all items are sourced. If any item has no supplier (skipped), the SO enters a `partially_sourced` status rather than `fulfilled`. A helper function `check_so_sourcing_status(order_id)` queries `order_fulfillment_links` vs `order_items` to determine if all demand lines are covered.
