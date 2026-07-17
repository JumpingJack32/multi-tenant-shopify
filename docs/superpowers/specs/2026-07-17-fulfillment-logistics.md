# Fulfillment Logistics — Specification

> **Status:** Draft  
> **Prerequisites:** Phase 1 & 2 Order Lifecycle (`Order`, `OrderItem`, inventory deduction at confirm/paid)

---

## 1. Domain Architecture

One `Order` has many `Fulfillment` instances (packages), enabling partial shipments and multi-package tracking.

```
+----------------+          +-------------------+          +-----------------------+
|     Order      | 1 -- *   |    Fulfillment    | 1 -- *   |    FulfillmentItem    |
| (Total financial) |       | (Physical Package)|          |  (Quantity Packaged)  |
+----------------+          +-------------------+          +-----------------------+
```

**Inventory boundary:** Fulfillment does **not** deduct inventory. Stock is already deducted during `confirm`/`paid` in the Phase 1 lifecycle. Fulfillment is purely about packing and shipping reserved stock.

---

## 2. Models

**File:** `src/orm/models/fulfillment.py`

```python
class FulfillmentStatus(str, Enum):
    PENDING = "pending"       # Packed, awaiting carrier scan
    TRANSIT = "transit"       # Picked up, tracking active
    DELIVERED = "delivered"   # Confirmed delivered
    CANCELLED = "cancelled"   # Voided — items return to unfulfilled pool
    EXCEPTION = "exception"   # Lost, damaged, RTS


class Fulfillment(BaseModel, table=True):
    __tablename__ = "fulfillments"
    order_id: UUID = Field(foreign_key="orders.id", index=True)
    status: FulfillmentStatus = Field(default=FulfillmentStatus.PENDING)
    tracking_number: str | None = None
    carrier: str | None = None  # "DHL", "FedEx", "Royal Mail"
    tracking_url: str | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None

    items: list["FulfillmentItem"] = Relationship(back_populates="fulfillment", cascade_delete=True)
    order: "Order" = Relationship(back_populates="fulfillments")


class FulfillmentItem(BaseModel, table=True):
    __tablename__ = "fulfillment_items"
    fulfillment_id: UUID = Field(foreign_key="fulfillments.id", index=True)
    order_item_id: UUID = Field(foreign_key="order_items.id")
    quantity: int = Field(ge=1)

    fulfillment: Fulfillment = Relationship(back_populates="items")
```

Register both in `src/orm/models/__init__.py`.

---

## 3. Dynamic Fulfillment Status

**File:** `src/orm/models/order.py` — add to `Order` model

Computed at response time, never stored:

```python
# On Order model
fulfillments: list["Fulfillment"] = Relationship(back_populates="order")
```

In `OrderResponse` or a helper:

```python
def compute_fulfillment_status(order) -> str:
    active_items = sum(
        fi.quantity
        for f in order.fulfillments
        if f.status != FulfillmentStatus.CANCELLED
        for fi in f.items
    )
    total_items = sum(oi.quantity for oi in order.items)
    if active_items == 0:
        return "unfulfilled"
    if active_items < total_items:
        return "partially_fulfilled"
    return "fulfilled"
```

---

## 4. FulfillmentService

**File:** `src/services/fulfillment_service.py`

```python
class FulfillmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_fulfillment(
        self, tenant_id: UUID, order_id: UUID,
        items_to_pack: list[dict], carrier: str | None = None,
        tracking_number: str | None = None,
    ) -> Fulfillment:
        # 1. Lock order
        order_stmt = select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id).with_for_update()
        order = (await self.db.exec(order_stmt)).one_or_none()
        if not order:
            raise HTTPException(404, "Order not found")

        # 2. Validate remaining quantities
        existing = await self._get_packed_quantities(tenant_id, order_id)
        for item_req in items_to_pack:
            oi_id = item_req["order_item_id"]
            requested = item_req["quantity"]
            remaining = existing[oi_id]["ordered"] - existing[oi_id]["packed"]
            if requested > remaining:
                raise HTTPException(422, f"Over-fulfillment: requested {requested}, remaining {remaining}")

        # 3. Create fulfillment
        fulfillment = Fulfillment(
            tenant_id=tenant_id, order_id=order_id,
            carrier=carrier, tracking_number=tracking_number,
        )
        self.db.add(fulfillment)
        await self.db.flush()

        for item_req in items_to_pack:
            fi = FulfillmentItem(fulfillment_id=fulfillment.id, **item_req)
            self.db.add(fi)

        await self.db.flush()
        await self.db.refresh(fulfillment)
        return fulfillment

    async def cancel_fulfillment(self, tenant_id: UUID, fulfillment_id: UUID) -> Fulfillment:
        stmt = select(Fulfillment).where(Fulfillment.id == fulfillment_id, Fulfillment.tenant_id == tenant_id)
        f = (await self.db.exec(stmt)).one_or_none()
        if not f:
            raise HTTPException(404, "Fulfillment not found")
        if f.status in (FulfillmentStatus.TRANSIT, FulfillmentStatus.DELIVERED):
            raise HTTPException(400, f"Cannot cancel a package that is already {f.status.value}")
        f.status = FulfillmentStatus.CANCELLED
        self.db.add(f)
        return f

    async def update_tracking(self, tenant_id: UUID, fulfillment_id: UUID, carrier: str, tracking: str, status: str) -> Fulfillment:
        stmt = select(Fulfillment).where(Fulfillment.id == fulfillment_id, Fulfillment.tenant_id == tenant_id)
        f = (await self.db.exec(stmt)).one_or_none()
        if not f:
            raise HTTPException(404, "Fulfillment not found")
        f.carrier = carrier
        f.tracking_number = tracking
        f.status = FulfillmentStatus(status)
        if f.status == FulfillmentStatus.TRANSIT:
            f.shipped_at = datetime.now(timezone.utc)
        elif f.status == FulfillmentStatus.DELIVERED:
            f.delivered_at = datetime.now(timezone.utc)
        self.db.add(f)
        return f
```

---

## 5. Admin API Endpoints

**File:** `src/routes/admin/fulfillments.py`

| Method  | Endpoint                            | Description                                        |
| ------- | ----------------------------------- | -------------------------------------------------- |
| `POST`  | `/admin/orders/{id}/fulfillments`   | Create fulfillment package                         |
| `GET`   | `/admin/orders/{id}/fulfillments`   | List fulfillments for an order                     |
| `PATCH` | `/admin/fulfillments/{id}/tracking` | Update tracking + carrier, bump status             |
| `POST`  | `/admin/fulfillments/{id}/cancel`   | Void fulfillment, items return to unfulfilled pool |

---

## 6. Fulfillment Status on `OrderResponse`

Add to the order response schema a derived `fulfillment_status: str` field computed from the fulfillments relationship.

---

## 7. Files Changed

| File                                  | Change                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| `src/orm/models/fulfillment.py`       | **New** — `Fulfillment`, `FulfillmentItem`, `FulfillmentStatus` |
| `src/orm/models/__init__.py`          | Export new models                                               |
| `src/orm/models/order.py`             | Add `fulfillments` relationship on `Order`                      |
| `src/services/fulfillment_service.py` | **New** — `FulfillmentService` with over-fulfillment protection |
| `src/routes/admin/fulfillments.py`    | **New** — fulfillment CRUD endpoints                            |
| `src/main.py`                         | Register new router                                             |
| `src/orm/schemas/order.py`            | Add `fulfillment_status` computed field                         |
| `seed_database.py`                    | No changes — no seed data for fulfillments                      |

---

## 8. Risks

| Risk                                         | Mitigation                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Over-fulfillment (packing more than ordered) | Validated against remaining delta — returns 422                                                    |
| Cancelling a shipped fulfillment             | `cancel_fulfillment` enforces status check — only `PENDING` can be cancelled; `TRANSIT`+ raise 400 |
| No inventory interaction                     | Deliberate — inventory was deducted at payment; fulfillment is a packaging operation only          |
