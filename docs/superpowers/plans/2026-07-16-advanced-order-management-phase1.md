# Advanced Order Management — Phase 1: Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-16-advanced-order-management-phase1.md`

---

## Step 1 — Add `inventory_deducted` to Order Model

**File:** `src/orm/models/order.py`

Add `inventory_deducted: bool = Field(default=False)` to the `Order` model.

## Step 2 — Create OrderLifecycleService

**File:** `src/services/order_lifecycle.py` (new)

Service class with methods for each transition:

- `confirm()` — validate transition, call `_deduct_inventory()`, set `inventory_deducted=True`
- `mark_paid()` — validate transition, call `_deduct_inventory()` if not yet deducted, set `inventory_deducted=True`
- `ship()`, `deliver()` — validate transition, no inventory side effects
- `cancel()` — validate transition, call `_replenish_inventory()` if `inventory_deducted`, flip flag
- `refund()` — same as cancel

Private helpers:

- `_deduct_inventory(order, tenant_id)` — sorted items, `FOR UPDATE`, tenant-scoped, `InsufficientStockError`
- `_replenish_inventory(order, tenant_id)` — sorted items, sequential replenish, tenant-scoped

## Step 3 — Add Transition Endpoints

**File:** `src/routes/orders.py`

Add 6 dedicated endpoints (`POST /orders/{id}/confirm`, `/pay`, `/ship`, `/deliver`, `/cancel`, `/refund`). Each instantiates `OrderLifecycleService`, calls the corresponding method, returns 422 on invalid transition or stock shortfall.

Keep existing `PUT /orders/{id}` for notes/metadata changes only.

## Step 4 — Add `transitions` to OrderResponse

**File:** `src/orm/schemas/order.py`

Add `transitions: list[str]` field derived from `VALID_TRANSITIONS` in `order_state_machine.py`. Compute at response time based on current status.

## Step 5 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
