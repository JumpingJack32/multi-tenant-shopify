# Webhook & Event Streams — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-18-webhook-event-streams.md`

---

## Step 1 — Event + Webhook Models

**Files:** `src/orm/models/event.py` (new), `src/orm/models/webhook.py` (new)

- `Event` — event_type, source, data (JSON), delivered, retry_count
- `WebhookSubscriber` — url, secret, event_types (JSON), is_active
- `WebhookDeliveryAttempt` — event_id, subscriber_id, status_code, success

## Step 2 — EventBus Service

**File:** `src/services/event_bus.py` (new)

Implement `EventBus` with:

- `publish()` — writes Event to DB, appends to request-scoped `staged` list
- `flush(staged)` — pushes staged events to in-memory queue after DB commit
- `start()` — infinite consumer loop with per-subscriber fan-out
- `_dispatch_event()` — fetches matching subscribers, spawns per-subscriber tasks
- `_deliver_to_subscriber()` — deterministic HMAC, HTTP POST, writes `WebhookDeliveryAttempt`

## Step 3 — Admin Webhook CRUD Endpoints

**File:** `src/routes/admin_webhooks.py` (new)

POST/GET/PUT/DELETE for `WebhookSubscriber`. GET events list + POST retry endpoint.

## Step 4 — Context Manager + Publisher Integration

**Files:** `src/services/event_bus.py`, `src/services/order_lifecycle.py`, `src/services/fulfillment_service.py`, `src/services/campaign_runner.py`

Add `outbox_context()` context manager to `event_bus.py` — provides a `publish` hook bound to a request-scoped `staged` list and auto-flushes after `db.commit()`. Use it in each service method instead of manual `staged` list management.

## Step 5 — Startup + Recovery Sweep + Delivered Resolver

**File:** `src/main.py`

- `EventBus.start()` recovers undelivered DB events on boot, then consumes live queue
- Spawn worker via `asyncio.create_task(event_bus.start())`
- Spawn delivered-flag resolver loop (60s interval)

## Step 6 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
