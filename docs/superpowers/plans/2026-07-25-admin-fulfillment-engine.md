# Admin Fulfillment Engine — Implementation Plan

**Spec:** Module A — Admin Order Fulfillment Engine & Inventory Sync

---

## Step 1 — Backend: Fulfillment Schemas

**File:** `services/backend-api/src/orm/schemas/fulfillment.py` (new)

- `CreateFulfillmentRequest` — `tracking_number`, `carrier`, `tracking_url`, `notify_customer`, `items: list[FulfillmentItemInput]`
- `FulfillmentItemInput` — `order_line_item_id`, `quantity`

---

## Step 2 — Backend: Fulfillment Service

**File:** `services/backend-api/src/services/fulfillment_service.py` (new)

Single transaction method `create_fulfillment(db, order_id, tenant_id, data)`:

1. Validate each line item: `requested_quantity <= (ordered_quantity - already_fulfilled_quantity)`
2. Create `Fulfillment` record with status `SHIPPED`
3. Create `FulfillmentItem` rows linking to order items
4. Deduct variant inventory: `variant.inventory_quantity -= quantity`
5. Recalculate order status: if all items fulfilled → `FULFILLED`, if some → `PARTIALLY_FULFILLED`, else stay `PROCESSING`

---

## Step 3 — Backend: Admin Endpoint

**File:** `services/backend-api/src/routes/admin.py` or new `admin_fulfillments.py`

- `POST /api/v1/admin/orders/{order_id}/fulfillments` — calls fulfillment service
- `GET /api/v1/admin/orders/{order_id}/fulfillments` — list fulfillments for an order

---

## Step 4 — Frontend: Fulfillment UI

**File:** `apps/admin/src/app/(app)/orders/[id]/page.tsx`

- "Fulfill Items" button opens a drawer/modal
- Carrier select + tracking number + tracking URL inputs
- Per-line-item quantity picker with remaining-unfulfilled max
- Submit calls `POST` endpoint, refetches order data

---

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit
cd apps/admin && pnpm exec eslint src/ --quiet
```
