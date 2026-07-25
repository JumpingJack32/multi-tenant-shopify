# Customer Order History & Post-Purchase Tracking — Implementation Plan

**Spec:** Module C — Storefront Post-Purchase Experience

---

## Step 1 — Backend: Customer Orders List Endpoint

**File:** `services/backend-api/src/routes/storefront.py`

- New `GET /{tenant_slug}/customers/orders` — returns all orders for the authenticated customer
- Customer identified by `customer_email` from query param or Clerk user metadata
- Orders sorted by `created_at DESC`, paginated
- Returns `list[OrderResponse]` (no new schema needed)

## Step 2 — Backend: Include Fulfillments in Order Response

**File:** `services/backend-api/src/orm/schemas/order.py`

- Add `fulfillments: list[FulfillmentResponse]` to `OrderResponse`
- Create `FulfillmentResponse` schema:
  ```python
  class FulfillmentResponse(BaseModel):
      id: UUID
      status: str
      tracking_number: Optional[str]
      carrier: Optional[str]
      tracking_url: Optional[str]
      shipped_at: Optional[datetime]
      delivered_at: Optional[datetime]
  ```
- Eager-load fulfillments in both order detail and list endpoints via `selectinload`

## Step 3 — Frontend: Orders List Page

**File:** `apps/storefront/src/app/[tenant]/account/orders/page.tsx`

- Fetch orders list from new backend endpoint
- Render card list: order number, date, status badge, item count, total
- Empty state with link to shop
- Link to `/[tenant]/account/orders/[id]` for detail

## Step 4 — Frontend: Order Detail Page

**File:** `apps/storefront/src/app/[tenant]/account/orders/[id]/page.tsx`

- Fetch single order with fulfillment data
- Status timeline: Placed → Processing → Shipped → Delivered
- Fulfillment cards: tracking number, carrier, tracking link button
- Line items with thumbnail, variant label, quantity, price
- Shipping address, billing summary, payment method

## Step 5 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/storefront && pnpm tsc --noEmit
cd apps/storefront && pnpm exec eslint src/ --quiet
```
