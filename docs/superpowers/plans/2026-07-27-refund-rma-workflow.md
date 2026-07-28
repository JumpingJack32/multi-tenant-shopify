# Refund & RMA Processing — Implementation Plan

**Spec:** Refund/RMA Workflow Engine (zero new models)

---

## Step 1 — RMA Service

**File:** `src/services/rma_service.py`

- `process_refund(db, tenant_id, order_id, refund_method, items, restock, warehouse_node_id, reason)`:
  1. Validate order exists + `payment_intent_id` is set
  2. Calculate refund total from line items
  3. If `stripe`: call `stripe.Refund.create(amount=cents)`
  4. If `store_credit`: increment `customer.store_credit`
  5. If `restock`: increment `InventoryStock.quantity` at the warehouse node
  6. Update `order.status` to `refunded` or keep `partial_refund` state
  7. Append refund note to `order.notes`

## Step 2 — Admin Endpoint

**File:** `src/routes/admin_rma.py`

- `POST /admin/orders/{order_id}/refund` — calls service, returns updated order

## Step 3 — Admin UI Modal

**File:** `apps/admin/src/components/orders/process-refund-modal.tsx`
- Item checklist with quantity pickers (max = purchased qty)
- Refund method: Stripe or Store Credit
- Restock toggle + warehouse node selector
- Total refund amount display
- Confirm button with warning context

## Step 4 — Wire into Order Detail

**File:** `apps/admin/src/app/(app)/orders/[id]/order-detail-content.tsx`
- "Issue Refund" button in the order action area
- Mounts the refund modal

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
