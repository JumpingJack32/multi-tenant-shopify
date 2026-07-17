# Advanced Order Management Phase 2 — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-17-advanced-order-management-phase2.md`

---

## Step 1 — Tax Engine: Model + Schema

**Files:** `src/orm/models/tenant.py`, `src/orm/schemas/__init__.py`

Add `TenantTaxConfig` model (default_rate as int ×10000, tax_inclusive, enabled). Add tax config request/response schemas.

## Step 2 — Tax Engine: Extend OrderItem

**File:** `src/orm/models/order.py`

Add `tax_rate: int` and `tax_amount: int` to `OrderItem`.

## Step 3 — Tax Engine: Calculation Service

**File:** `src/services/tax_service.py` (new)

Implement `calculate_tax()` with half-up rounding via `_round_half_up()` helper. Supports inclusive and exclusive tax modes.

## Step 4 — Tax Engine: Endpoints

**Files:** `src/routes/settings.py` (new), `src/routes/orders.py`

- `GET/PUT /settings/taxes` — read/update tenant tax config
- `POST /orders/{id}/recalculate-tax` — apply tax rates to all line items

## Step 5 — Multi-Address: Extend CustomerAddress

**File:** `src/orm/models/order.py`

Add `label`, `is_default_shipping`, `is_default_billing` to `CustomerAddress`.

## Step 6 — Multi-Address: Service Layer

**File:** `src/services/address_service.py` (new)

Implement `set_default_shipping()` and `set_default_billing()` — clear existing defaults, set new one, sync legacy `is_default` field.

## Step 7 — Multi-Address: Endpoints

**File:** `src/routes/customers.py`

Add `POST /customers/{id}/addresses`, `PUT /customers/{id}/addresses/{addr_id}`, `DELETE /customers/{id}/addresses/{addr_id}` with guard against deletion of addresses referenced by open orders.

## Step 8 — Store Credit Refund Hook

**File:** `src/services/order_lifecycle.py`

Modify `refund()` to auto-issue store credit via `StoreCreditTransaction` when `issue_credit=True`. Add re-check guard against concurrent double-credit.

## Step 9 — Seed Script

**File:** `seed_database.py`

Add default `TenantTaxConfig` row for each tenant. Update address INSERT with new fields.

## Step 10 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
