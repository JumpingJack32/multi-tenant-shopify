# Campaign Dispatch — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-19-campaign-dispatch.md`

---

## Step 1 — Data Models & Migration

### 1a — Create dispatch models

**File:** `services/backend-api/src/orm/models/dispatch.py` (new)

- `CampaignDispatch` with `DispatchStatus` enum, FK to `campaign_templates` and `saved_segments`, HTML snapshot, schedule, counters
- `CampaignDispatchRecipient` with per-customer status tracking

### 1b — Create Pydantic schemas

**File:** `services/backend-api/src/orm/schemas/dispatch.py` (new)

- `DispatchCreate`, `DispatchResponse`, `DispatchScheduleRequest`

### 1c — Generate and run migration

```bash
cd services/backend-api && PYTHONPATH=. doppler run -- uv run alembic revision --autogenerate -m "add campaign dispatch tables"
PYTHONPATH=. doppler run -- uv run alembic upgrade head
```

---

## Step 2 — Resend Batch Integration

### 2a — Add `send_batch` to email service

**File:** `services/backend-api/src/services/email_service.py`

```python
async def send_batch(self, emails: list[dict]) -> list[bool]:
    """Send up to 100 emails via Resend /v1/emails/batch."""
```

Each item: `{ from: str, to: [email], subject: str, html: str }`. Returns list of success booleans in same order.

---

## Step 3 — API Endpoints

### 3a — Add dispatch endpoints

**File:** `services/backend-api/src/routes/marketing_templates.py`

- `POST /dispatches` — create, snapshot HTML, bulk INSERT recipients, schedule
- `GET /dispatches` — list with pagination
- `GET /dispatches/{id}` — detail with stats
- `POST /dispatches/{id}/schedule` — set scheduled_at, transition to SCHEDULED
- `POST /dispatches/{id}/cancel` — return to DRAFT

### 3b — Bulk recipient INSERT

Use raw SQL for recipient population:

```sql
INSERT INTO campaign_dispatch_recipients (id, dispatch_id, customer_id, email, status)
SELECT gen_random_uuid(), :dispatch_id, c.id, c.email, 'pending'
FROM customers c
WHERE c.tenant_id = :tenant_id AND c.email_subscription_status = 'subscribed'
-- + segment filter criteria from saved_segment.filters
```

---

## Step 4 — Campaign Runner Extension

### 4a — Add dispatch processing to runner

**File:** `services/backend-api/src/services/campaign_runner.py`

- `_process_dispatches(self, db)` — `SELECT ... FOR UPDATE SKIP LOCKED` for SCHEDULED + stalled PROCESSING, creates tasks
- `_send_dispatch(self, dispatch)` — streams pending recipients, batches of 100 via Resend batch, updates recipient rows plus dispatch counters
- Stale recovery: picks up PROCESSING dispatches > 5 min old

---

## Step 5 — Verify

```bash
# Backend
cd services/backend-api && PYTHONPATH=. doppler run -- uv run pytest -q

# Frontend types
pnpm --filter admin exec tsc --noEmit

# Full test suite
pnpm vitest run
```
