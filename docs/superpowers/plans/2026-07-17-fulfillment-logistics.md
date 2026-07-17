# Fulfillment Logistics — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-fulfillment-logistics.md`

---

## Step 1 — Fulfillment Models

**Files:** `src/orm/models/fulfillment.py` (new), `src/orm/models/__init__.py`, `src/orm/models/order.py`

Create `FulfillmentStatus` enum, `Fulfillment`, `FulfillmentItem` models. Add `fulfillments` relationship to `Order`. Register exports.

## Step 2 — FulfillmentService

**File:** `src/services/fulfillment_service.py` (new)

Implement `FulfillmentService` with:

- `create_fulfillment()` — lock order, validate remaining quantities, create records
- `cancel_fulfillment()` — guard against TRANSIT/DELIVERED cancellation
- `update_tracking()` — update carrier/tracking, bump status, set timestamps

## Step 3 — Fulfillment Schemas

**Files:** `src/orm/schemas/__init__.py`

Add request/response schemas for fulfillment CRUD.

## Step 4 — Admin Fulfillment Endpoints

**File:** `src/routes/admin/fulfillments.py` (new), `src/main.py`

4 endpoints: POST create, GET list, PATCH tracking, POST cancel. Register router in `main.py`.

## Step 5 — Computed `fulfillment_status` on Order

**File:** `src/orm/schemas/order.py`

Add `fulfillment_status: str` computed field to `OrderResponse` via validator.

## Step 6 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
