# Advanced Order Management — Phase 2: Tax Engine, Multi-Address, Store Credit Hook

> **Status:** Draft  
> **Prerequisites:** Phase 1 (OrderLifecycleService, inventory deduction, transition endpoints)

---

## 1. Overview

Three features that complete the order financial loop:

1. **Tax Engine** — Per-tenant configurable tax rates, inclusive/exclusive pricing, line-item breakdown
2. **Customer Multi-Address** — Multiple shipping/billing addresses with default labels
3. **Store Credit Refund Hook** — Auto-issue store credit when an order transitions to refunded

---

## 2. Feature 1: Multi-Tenant Tax Engine

### 2.1 Model: `TenantTaxConfig`

**File:** `src/orm/models/tenant.py`

```python
class TenantTaxConfig(BaseModel, table=True):
    __tablename__ = "tenant_tax_configs"
    default_rate: int = Field(default=0)  # rate × 10000, e.g. 825 = 8.25%
    tax_inclusive: bool = Field(default=False)
    enabled: bool = Field(default=True)
```

Inherits `id`, `tenant_id`, `created_at`, `updated_at` from `BaseModel`. One row per tenant.

### 2.2 Extend `OrderItem`

**File:** `src/orm/models/order.py`

```python
# On OrderItem
tax_rate: int = Field(default=0)      # rate × 10000, captured at transaction time
tax_amount: int = Field(default=0)     # in pence
```

Capturing these at the line-item level provides a permanent audit trail regardless of future rate changes.

### 2.3 Calculation Logic

**File:** `src/services/tax_service.py` (new)

```python
def _round_half_up(value: int, divisor: int) -> int:
    """Integer division with half-up rounding: (value + divisor/2) // divisor"""
    return (value + divisor // 2) // divisor

async def calculate_tax(
    subtotal: int,           # pence
    tax_rate: int,           # rate × 10000 (e.g. 825 = 8.25%)
    tax_inclusive: bool,
) -> tuple[int, int]:        # (tax_amount, adjusted_subtotal)
    if tax_inclusive:
        divisor = 10_000 + tax_rate
        base = _round_half_up(subtotal * 10_000, divisor)
        tax = subtotal - base
        return tax, base
    else:
        tax = _round_half_up(subtotal * tax_rate, 10_000)
        return tax, subtotal
```

### 2.4 API Endpoints

| Method | Endpoint                       | Description                                               |
| ------ | ------------------------------ | --------------------------------------------------------- |
| `GET`  | `/settings/taxes`              | Get tenant tax config                                     |
| `PUT`  | `/settings/taxes`              | Update tax config                                         |
| `POST` | `/orders/{id}/recalculate-tax` | Recalculate taxes on an existing order (line-item update) |

### 2.5 Schema

```python
class TaxConfigResponse(PydanticBaseModel):
    default_rate: int       # × 10000
    tax_inclusive: bool
    enabled: bool

class TaxConfigUpdate(PydanticBaseModel):
    default_rate: int | None = None
    tax_inclusive: bool | None = None
    enabled: bool | None = None
```

---

## 3. Feature 2: Customer Multi-Address Management

### 3.1 Extend `CustomerAddress`

**File:** `src/orm/models/order.py`

```python
# New fields on CustomerAddress
label: str = Field(default="Home", max_length=50)
is_default_shipping: bool = Field(default=False)
is_default_billing: bool = Field(default=False)
```

The existing `is_default` field remains for backward compatibility with the address creation flow in the customer form. The new `is_default_shipping` and `is_default_billing` replace its semantics.

### 3.2 Service Layer

**File:** `src/services/address_service.py` (new)

```python
async def set_default_shipping(db, customer_id, address_id, tenant_id):
    """Clear existing shipping default, set new one.
    Also syncs the legacy is_default field for backward compatibility."""
    stmt = (
        update(CustomerAddress)
        .where(CustomerAddress.customer_id == customer_id, CustomerAddress.tenant_id == tenant_id)
        .values(is_default_shipping=False, is_default=False)
    )
    await db.exec(stmt)
    addr = await db.get(CustomerAddress, address_id)
    if addr:
        addr.is_default_shipping = True
        addr.is_default = True  # sync legacy field
        db.add(addr)
```

Same pattern for `set_default_billing` — sets `is_default_billing = True` and legacy `is_default = True`.

### 3.3 API Endpoints

| Method   | Endpoint                              | Description                                        |
| -------- | ------------------------------------- | -------------------------------------------------- |
| `POST`   | `/customers/{id}/addresses`           | Add secondary address                              |
| `PUT`    | `/customers/{id}/addresses/{addr_id}` | Edit address, toggle defaults                      |
| `DELETE` | `/customers/{id}/addresses/{addr_id}` | Remove address (block if referenced by open order) |

### 3.4 Guard on Delete

Before deleting an address, check that no open (non-cancelled/non-refunded) orders reference it:

```python
stmt = select(Order).where(
    Order.shipping_address_id == address_id,
    Order.tenant_id == tenant_id,
    Order.status.not_in(["cancelled", "refunded"]),
)
```

---

## 4. Feature 3: Store Credit Refund Hook

**No new models needed.** The `StoreCreditTransaction` model, `POST /customers/{id}/credit` endpoint, and `OrderLifecycleService` already exist from Phase 1.

### 4.1 Change: `OrderLifecycleService.refund()`

When refunding an order, automatically issue store credit for the order total:

```python
async def refund(self, order_id: UUID, tenant_id: UUID, issue_credit: bool = True) -> Order:
    order = await self._get_order(order_id, tenant_id)
    validate_transition(order.status.value, OrderStatus.REFUNDED.value)

    if order.inventory_deducted:
        await self._replenish_inventory(order, tenant_id)
        order.inventory_deducted = False

    if issue_credit and order.total > 0:
        from src.orm.models.order import Customer, StoreCreditTransaction

        # Re-check status under lock to prevent double-credit from concurrent calls
        current = await self._get_order(order_id, tenant_id)
        if current.status == OrderStatus.REFUNDED:
            return order

        customer = (await self.db.exec(
            select(Customer).where(Customer.id == order.customer_id, Customer.tenant_id == tenant_id)
        )).one_or_none()
        if customer:
            customer.store_credit += order.total
            self.db.add(customer)

            tx = StoreCreditTransaction(
                customer_id=customer.id,
                tenant_id=tenant_id,
                amount=order.total,
                balance_after=customer.store_credit,
                reason=f"Refund for Order #{order.order_number}",
            )
            self.db.add(tx)

    order.status = OrderStatus.REFUNDED
    self.db.add(order)
    return order
```

---

## 5. Files Changed

| File                              | Change                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/orm/models/tenant.py`        | Add `TenantTaxConfig`                                                                                                  |
| `src/orm/models/order.py`         | Add `tax_rate`, `tax_amount` to `OrderItem`; `label`, `is_default_shipping`, `is_default_billing` to `CustomerAddress` |
| `src/orm/models/__init__.py`      | Export new model                                                                                                       |
| `src/orm/schemas/__init__.py`     | Export tax config schemas                                                                                              |
| `src/services/tax_service.py`     | **New** — tax calculation logic                                                                                        |
| `src/services/address_service.py` | **New** — multi-address default management                                                                             |
| `src/services/order_lifecycle.py` | Modify `refund()` to auto-issue store credit                                                                           |
| `src/routes/orders.py`            | Add `POST /orders/{id}/recalculate-tax`                                                                                |
| `src/routes/settings.py`          | Add tax config GET/PUT                                                                                                 |
| `src/routes/customers.py`         | Add address CRUD endpoints                                                                                             |
| `seed_database.py`                | Add tax config seed + address field defaults                                                                           |
| `tests/`                          | Tests for tax calc, address service, refund hook                                                                       |

---

## 6. Risks

| Risk                                       | Mitigation                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Integer division rounding in tax calc      | Use `× 10_000` rate precision; test edge cases (e.g. 3 items £10 each with 8.25% tax) |
| Deleting an address referenced by an order | Guard check on delete; return 409 Conflict if referenced                              |
| Store credit issued twice for same refund  | `inventory_deducted` flag also gates credit issuance; idempotent on status check      |
| Multi-address `is_default` conflicts       | Service layer clears existing defaults before setting new ones                        |
