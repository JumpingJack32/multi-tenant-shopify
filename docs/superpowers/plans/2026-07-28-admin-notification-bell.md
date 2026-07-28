# Admin Notification Bell — Implementation Plan

**Spec:** Admin Notification Bell & Alert Engine

---

## Step 1 — Notification Service + Endpoint

**File:** `src/services/notification_service.py`

- `get_notifications(db, tenant_id)` — single-flight query returning aggregated alerts:
  - `low_stock` — inventory_stocks where quantity <= 10
  - `past_due_subs` — customer_subscriptions where status = 'past_due'
  - `pending_returns` — orders where notes contain "Refunded" but status isn't fully resolved
  - `unfulfilled_orders` — orders where status = 'paid' and created_at > 24h

**File:** `src/routes/admin_notifications.py`
- `GET /admin/notifications` — returns list of `{type, severity, title, description, link, timestamp}`

## Step 2 — NotificationBell Component

**File:** `apps/admin/src/components/layout/notification-bell.tsx`
- Bell icon with red unread badge
- Popover listing grouped alert cards
- Each card: type icon, title, description, timestamp, deep link
- "Mark as Read" clears local badge state

## Step 3 — Wire into Header

**File:** `apps/admin/src/components/layout/header.tsx` (or find the actual header component)
- Import and mount `<NotificationBell />` next to the user menu

## Step 4 — Verify

```bash
cd services/backend-api && doppler run -- uv run pytest -q --tb=short
cd apps/admin && pnpm tsc --noEmit && pnpm exec eslint src/ --quiet
```
