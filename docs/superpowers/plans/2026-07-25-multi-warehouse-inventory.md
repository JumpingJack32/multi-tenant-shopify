# Multi-Warehouse & Inventory Nodes — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-25-multi-warehouse-inventory.md`

---

## Step 1 — Models + Migration

**Files:** `src/orm/models/inventory.py`, `src/orm/models/__init__.py`

- `InventoryNode` (tenant-scoped, name, type, priority, is_active, address)
- `InventoryStock` (variant_id, node_id, quantity, reserved — unique pair)
- `InventoryTransfer` (from_node, to_node, variant, quantity, status, reason)
- Alembic migration: create tables + seed "Main Warehouse" per tenant + backfill `InventoryStock` from `Variant.inventory_quantity`
- `Variant.inventory_quantity` preserved as denormalized cache

## Step 2 — Inventory Service

**File:** `src/services/inventory_service.py`

- `reserve(variant_id, node_id, quantity)` — atomic `UPDATE ... SET reserved = reserved + :qty WHERE (quantity - reserved) >= :qty`
- `deduct(variant_id, node_id, quantity)` — atomic `UPDATE ... SET quantity = quantity - :qty, reserved = reserved - :qty`
- `release(variant_id, node_id, quantity)` — atomic `UPDATE ... SET reserved = reserved - :qty`
- `auto_allocate(variant_id, quantity)` — picks best node by active → priority → sufficient stock
- `recompute_cache(variant_id)` — updates `Variant.inventory_quantity` as sum across all nodes
- `create_transfer(from_node, to_node, variant, quantity, reason)` — creates + completes transfer in one transaction

## Step 3 — Admin Endpoints

**File:** `src/routes/inventory.py` (update existing)

- `GET/POST /admin/inventory/nodes`, `PUT/DELETE /admin/inventory/nodes/{id}`
- `GET /admin/inventory/nodes/{id}/stock`, `PUT /admin/inventory/stock`
- `POST /admin/inventory/transfers`, `PATCH /admin/inventory/transfers/{id}`

## Step 4 — Checkout + Fulfillment Wiring

**File:** `src/routes/storefront.py`, `src/routes/admin_fulfillments.py`

- Checkout: call `auto_allocate` for each variant → `reserve` on chosen node
- Fulfillment: accept optional `node_id` → `deduct` from that node
- Cancel: call `release` on reserved node

## Step 5 — Admin UI

**Files:** `apps/admin/src/app/(app)/products/inventory/nodes/page.tsx`, `apps/admin/src/app/(app)/products/inventory/stock/page.tsx`, `apps/admin/src/app/(app)/products/inventory/transfers/page.tsx`

- Nodes: list, create, edit, deactivate
- Stock: per-node variant viewer, inline quantity edit
- Transfers: create (from → to → variant → qty → reason), list with status

## Step 6 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
cd apps/storefront && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
