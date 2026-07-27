# Multi-Warehouse & Inventory Nodes

**Goal:** Track variant stock across multiple physical locations (warehouses, retail stores) instead of a single global counter. Route fulfillment from specific locations.

---

## 1. Existing Foundation

The codebase already has a `Location` model at `src/orm/models/product.py` with fields for name, address, and type. Variant quantities are currently tracked as a single `Variant.inventory_quantity` integer.

The gap: no per-location stock tracking, no fulfillment-location assignment, no transfer between locations.

---

## 2. New Models

### InventoryNode — a physical storage location

```python
class InventoryNode(BaseModel, table=True):
    __tablename__ = "inventory_nodes"

    tenant_id: UUID = Field(foreign_key="tenants.tenant_id", index=True)
    name: str
    type: str                          # "warehouse" | "retail" | "dropshipper"
    is_active: bool = True
    priority: int = Field(default=0)   # lower = preferred for auto-allocation
    address: dict = Field(default_factory=dict)
```

### InventoryStock — per-variant, per-node quantity

```python
class InventoryStock(BaseModel, table=True):
    __tablename__ = "inventory_stocks"
    __table_args__ = (
        UniqueConstraint("variant_id", "node_id"),
    )

    variant_id: UUID = Field(foreign_key="variants.id")
    node_id: UUID = Field(foreign_key="inventory_nodes.id")
    quantity: int = Field(default=0, ge=0)
    reserved: int = Field(default=0, ge=0)
```

**Available stock per node:** `quantity - reserved` (enforced via `CHECK` constraint or service-level SQL).

### InventoryTransfer — audit trail for inter-node movement

```python
class InventoryTransfer(BaseModel, table=True):
    __tablename__ = "inventory_transfers"

    tenant_id: UUID = Field(foreign_key="tenants.tenant_id")
    from_node_id: UUID = Field(foreign_key="inventory_nodes.id")
    to_node_id: UUID = Field(foreign_key="inventory_nodes.id")
    variant_id: UUID = Field(foreign_key="variants.id")
    quantity: int
    status: str    # "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"
    reason: Optional[str]
```

---

## 3. Stock Lifecycle

```
[Checkout] → reserve(node_id, qty)     — increments InventoryStock.reserved
[Fulfill]  → deduct(node_id, qty)      — decrements both quantity and reserved
[Cancel]   → release(node_id, qty)     — decrements reserved only
```

### Checkout reservation (atomic SQL)

```sql
UPDATE inventory_stocks
SET reserved = reserved + :qty
WHERE variant_id = :vid AND node_id = :nid AND (quantity - reserved) >= :qty
```

If zero rows affected, no node had sufficient stock → fail checkout.

### Auto-allocation priority

When no node is specified (default checkout):
1. `is_active == True`
2. Lowest `priority` value (primary fulfillment center first)
3. Node with `(quantity - reserved) >= line_item_qty` to avoid split shipments
4. Fallback: any node with available stock, split if necessary

---

## 4. Variant.inventory_quantity — Denormalized Cache

Keep `Variant.inventory_quantity` as a cached sum — updated via trigger or service callback after any `InventoryStock` mutation:

```
Variant.inventory_quantity = SUM(inventory_stocks.quantity - inventory_stocks.reserved)
```

Storefront PLP/PDP queries continue reading this single column. No JOINs on catalog requests.

---

## 5. Migration Strategy

1. Create default `"Main Warehouse"` `InventoryNode` for every existing `Tenant`
2. For each `Variant`, insert `InventoryStock(node=default, quantity=Variant.inventory_quantity, reserved=0)`
3. `Variant.inventory_quantity` remains populated (will be recomputed from the sum going forward)

---

## 6. Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/inventory/nodes` | List nodes for tenant |
| `POST` | `/admin/inventory/nodes` | Create node |
| `PUT` | `/admin/inventory/nodes/{id}` | Update node |
| `DELETE` | `/admin/inventory/nodes/{id}` | Deactivate node |
| `GET` | `/admin/inventory/nodes/{id}/stock` | List variant stock for a node |
| `PUT` | `/admin/inventory/stock` | Set/adjust stock for variant+node |
| `POST` | `/admin/inventory/transfers` | Create transfer between nodes |
| `PATCH` | `/admin/inventory/transfers/{id}` | Complete/cancel transfer |

---

## 7. Admin UI

- **Nodes page** — list/create/edit nodes with priority, type, active toggle
- **Stock table** — per-node variant stock viewer with inline editing
- **Transfer form** — from-node, to-node, variant, quantity, reason

---

## 8. Files Changed

| File | Change |
|------|--------|
| `src/orm/models/inventory.py` | New: `InventoryNode`, `InventoryStock`, `InventoryTransfer` |
| `src/orm/schemas/inventory.py` | New: request/response schemas |
| `src/routes/inventory.py` | Update: add node + stock + transfer endpoints |
| `src/services/inventory_service.py` | New: atomic reserve/deduct/release + auto-allocation logic |
| `apps/admin/src/app/(app)/products/inventory/` | New: nodes page + stock viewer + transfer form |
| `seed_database.py` | Seed default warehouse per tenant, backfill stock from variants |
