# Advanced Order Management — Phase 1: State Machine & Inventory Deduction

> **Status:** Draft  
> **Prerequisites:** Existing `OrderStatus` enum, `order_state_machine.py`, `Inventory` model

---

## 1. Problem

The current order system has:

- A state machine (`order_state_machine.py`) with valid transitions but **no enforcement** at the route level for all flows
- **No inventory deduction** when an order transitions to `confirmed` or `paid` — stock is never decremented
- **No stock replenishment** when an order is `cancelled` or `refunded`
- **No guard** against overselling (accepting an order for more stock than available)

---

## 2. Scope

**Goal:** Wire the existing state machine into a lifecycle service that mutates inventory quantities atomically with status transitions.

**Out of scope:** Tax calculation, refund-to-store-credit, payment gateway integration.

---

## 3. Architecture

```
Order Create → pending
                  │
            [confirm] ──→ deduct inventory (lock rows with FOR UPDATE)
                  │
            [mark paid] ──→ deduct inventory (if not already deducted)
                  │
            [ship] ──→ mark shipped
                  │
            [deliver] ──→ mark delivered
                  │
            [cancel] ──→ replenish inventory (reverse deduction)
                  │
            [refund] ──→ replenish inventory (reverse deduction)
```

---

## 4. Service Layer: `OrderLifecycleService`

**File:** `src/services/order_lifecycle.py` (new)

Encapsulates all order state transitions with side effects:

```python
class OrderLifecycleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def confirm(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition pending → confirmed. Deduct inventory."""
        ...

    async def mark_paid(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition → paid. Deduct inventory if not yet deducted."""
        ...

    async def ship(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition → shipped."""
        ...

    async def deliver(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition → delivered."""
        ...

    async def cancel(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition → cancelled. Replenish inventory."""
        ...

    async def refund(self, order_id: UUID, tenant_id: UUID) -> Order:
        """Transition → refunded. Replenish inventory."""
        ...
```

Each method:

1. Validates the transition via `validate_transition(order.status, target)`
2. Locks order items via `SELECT ... FOR UPDATE` on inventory rows
3. Performs the side effect (deduct/replenish)
4. Updates the order status
5. Returns the updated order

---

## 5. Order Model: `inventory_deducted` Flag

**File:** `src/orm/models/order.py`

Add a boolean flag to prevent double-deduction and double-replenishment:

```python
# On Order model
inventory_deducted: bool = Field(default=False)
```

- `confirm` and `mark_paid` check this flag before calling `_deduct_inventory()`
- `cancel` and `refund` check this flag before calling `_replenish_inventory()` and flip it back to `False`

This cleanly handles the case where an order transitions directly from `pending → paid` (deduct now) vs `pending → confirmed → paid` (already deducted at confirm).

---

## 6. Inventory Deduction Logic

**File:** `src/services/order_lifecycle.py`

```python
class InsufficientStockError(Exception):
    def __init__(self, variant_id: UUID, available: int, requested: int):
        self.variant_id = variant_id
        self.available = available
        self.requested = requested
        super().__init__(f"Insufficient stock for variant {variant_id}: {available} available, {requested} requested")

async def _deduct_inventory(self, order: Order, tenant_id: UUID):
    """Deduct inventory for all items in an order. Raises InsufficientStockError on shortfall.
    Items are sorted by variant_id to guarantee consistent lock ordering,
    preventing database deadlocks between concurrent order transitions."""
    sorted_items = sorted(order.items, key=lambda x: x.variant_id)
    for item in sorted_items:
        inventory_stmt = (
            select(Inventory)
            .where(Inventory.variant_id == item.variant_id, Inventory.tenant_id == tenant_id)
            .with_for_update()
        )
        inv_records = (await self.db.exec(inventory_stmt)).all()
        total_available = sum(r.quantity - r.reserved_quantity for r in inv_records)

        if total_available < item.quantity:
            raise InsufficientStockError(
                variant_id=item.variant_id,
                available=total_available,
                requested=item.quantity,
            )

        remaining = item.quantity
        for inv in inv_records:
            if remaining <= 0:
                break
            deductible = min(remaining, inv.quantity - inv.reserved_quantity)
            if deductible > 0:
                inv.quantity -= deductible
                remaining -= deductible
                self.db.add(inv)

async def _replenish_inventory(self, order: Order, tenant_id: UUID):
    """Reverse inventory deduction — add quantities back.
    Uses sequential replenishment to avoid rounding free-inventory bugs."""
    sorted_items = sorted(order.items, key=lambda x: x.variant_id)
    for item in sorted_items:
        inventory_stmt = (
            select(Inventory)
            .where(Inventory.variant_id == item.variant_id, Inventory.tenant_id == tenant_id)
            .with_for_update()
        )
        inv_records = (await self.db.exec(inventory_stmt)).all()

        remaining = item.quantity
        for inv in inv_records:
            if remaining <= 0:
                break
            inv.quantity += remaining
            remaining = 0
            self.db.add(inv)
```

---

## 7. Route Changes

**File:** `src/routes/orders.py`

Add dedicated transition endpoints replacing the generic `PUT /orders/{id}`:

| Method | Endpoint               | Action                       |
| ------ | ---------------------- | ---------------------------- |
| `POST` | `/orders/{id}/confirm` | Confirm → deduct inventory   |
| `POST` | `/orders/{id}/pay`     | Mark paid                    |
| `POST` | `/orders/{id}/ship`    | Mark shipped                 |
| `POST` | `/orders/{id}/deliver` | Mark delivered               |
| `POST` | `/orders/{id}/cancel`  | Cancel → replenish inventory |
| `POST` | `/orders/{id}/refund`  | Refund → replenish inventory |

Keep the existing `PUT /orders/{id}` for updating notes and metadata (non-status changes).

Each endpoint returns 422 with `InsufficientStockError` details on stock shortfall.

---

## 8. Error Responses

**Insufficient stock (422):**

```json
{
  "detail": "Insufficient stock for variant SKU-001: 5 available, 10 requested"
}
```

**Invalid transition (422):**

```json
{
  "detail": "Cannot transition order ORD-0042 from 'shipped' to 'pending'"
}
```

---

## 9. Order Response Enhancement

Add `transitions` field to `OrderResponse` showing available next actions:

```json
{
  "id": "...",
  "status": "confirmed",
  "transitions": ["pay", "ship", "cancel"],
  ...
}
```

Derived from `VALID_TRANSITIONS` in `order_state_machine.py`.

---

## 10. Files Changed

| File                              | Change                                                         |
| --------------------------------- | -------------------------------------------------------------- |
| `src/services/order_lifecycle.py` | **New** — lifecycle service with inventory deduction/replenish |
| `src/routes/orders.py`            | Add 6 transition endpoints, add `transitions` to response      |
| `src/orm/schemas/order.py`        | Add `transitions` field to `OrderResponse`                     |
| `tests/test_order_lifecycle.py`   | **New** — unit tests for lifecycle + inventory                 |

---

## 11. Risks

| Risk                                                 | Mitigation                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Race condition on inventory during concurrent orders | `with_for_update()` locks the inventory rows; second request waits                 |
| Database deadlock from out-of-order lock acquisition | Items sorted by `variant_id` before locking — consistent order prevents deadlock   |
| Partial deduction if worker crashes mid-batch        | Service is called inside the request transaction; failed = rollback = no deduction |
| Overselling when stock is split across locations     | Sum available across all locations before deducting                                |
| Tenant B mutating Tenant A's inventory               | All inventory queries scoped by `tenant_id` alongside `variant_id`                 |
| Double-replenishment if order cancelled twice        | `inventory_deducted` flag ensures side effects only fire once                      |
