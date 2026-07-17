# Storefront Tax & Checkout Integration — Specification

> **Status:** Draft  
> **Prerequisites:** Phase 2 Tax Engine (`tax_service.py`, `TenantTaxConfig`), existing `POST /storefront/checkout`

---

## 1. Scope

Wire the existing Phase 2 tax calculation service into the storefront checkout flow. No new endpoints, no new models — just schema extensions and route integration.

---

## 2. Backend: Cart Model

**File:** `src/orm/models/cart.py`

Add `tax_total` to track calculated tax at the cart level:

```python
# On Cart model
tax_total: int = Field(default=0, ge=0)
```

## 3. Backend: Schema Updates

**File:** `src/orm/schemas/cart.py`

Add `tax_total` to `CartResponse`:

```python
class CartResponse(PydanticBaseModel):
    id: UUID
    subtotal: int
    tax_total: int = 0   # NEW
    total: int
    currency: str
    ...
```

## 4. Backend: Storefront Checkout Route

**File:** `src/routes/storefront.py` — modify `POST /storefront/checkout`

The existing endpoint creates an order from the cart. The change: calculate tax from `TenantTaxConfig` and apply it to each `OrderItem`, then update the order totals.

```python
@router.post("/storefront/checkout")
async def storefront_checkout(body: ..., db, tenant_id, background_tasks):
    cart = ...  # existing cart fetch logic
    tax_config = await db.get(TenantTaxConfig, tenant_id)

    tax_total = 0
    for cart_item in cart.items:
        item_subtotal = cart_item.price * cart_item.quantity
        if tax_config and tax_config.enabled:
            item_tax, _ = calculate_tax(item_subtotal, tax_config.default_rate, tax_config.tax_inclusive)
        else:
            item_tax = 0
        tax_total += item_tax
        # Store tax on OrderItem (tax_rate, tax_amount fields from Phase 2)
        order_item.tax_rate = tax_config.default_rate if tax_config else 0
        order_item.tax_amount = item_tax

    # Update totals
    order.subtotal = cart.subtotal
    order.tax = tax_total
    # For inclusive tax, total = subtotal (tax is embedded in prices)
    # For exclusive tax, total = subtotal + tax_total
    order.total = cart.subtotal if tax_config.tax_inclusive else cart.subtotal + tax_total
```

The cart's `tax_total` is set when the cart is fetched, not during checkout — the checkout route computes fresh tax from the current config.

## 5. Backend: Cart Endpoint Tax

**File:** `src/routes/storefront.py` — modify `GET /storefront/cart`

When returning the cart, compute `tax_total` from the current tenant config so the summary panel can display it:

```python
@router.get("/storefront/cart")
async def get_cart(...):
    cart = ...
    tax_config = await db.get(TenantTaxConfig, tenant_id)
    tax_total = 0
    if tax_config and tax_config.enabled:
        for item in cart.items:
            item_subtotal = item.price * item.quantity
            item_tax, _ = calculate_tax(item_subtotal, tax_config.default_rate, tax_config.tax_inclusive)
            tax_total += item_tax
    cart.tax_total = tax_total
    return cart
```

This keeps the tax calculation on the backend — the frontend simply reads `cart.tax_total`.

## 6. Frontend: Storefront Summary Panel

**File:** `apps/storefront/src/components/checkout/summary-panel.tsx`

Add a dynamic tax line after subtotal:

```tsx
<div className="flex justify-between">
  <span>
    Tax{cart.tax_total > 0 ? ` (Estimated)` : ` (Calculated at checkout)`}
  </span>
  <span>{formatCurrency(cart.tax_total)}</span>
</div>
```

If `tax_total` is 0 and no address has been entered, display `£0.00 (Calculated at checkout)`. Ensure `formatCurrency` renders `0` as `£0.00` (never hides the line).

## 7. Files Changed

| File                                                        | Change                                                                |
| ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/orm/models/cart.py`                                    | Add `tax_total` field                                                 |
| `src/orm/schemas/cart.py`                                   | Add `tax_total` to `CartResponse`                                     |
| `src/routes/storefront.py`                                  | Compute tax in `GET /storefront/cart` and `POST /storefront/checkout` |
| `apps/storefront/src/components/checkout/summary-panel.tsx` | Add dynamic tax line                                                  |

## 8. Risks

| Risk                                        | Mitigation                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| Tax shown before address is entered         | Display `£0.00 (Calculated at checkout)` until shipping address is provided |
| Tax config disabled or missing              | Graceful fallback to 0 — same behavior as pre-tax system                    |
| Cart subtotal changes after tax is computed | Tax is recomputed on every cart fetch and on checkout — always current      |
