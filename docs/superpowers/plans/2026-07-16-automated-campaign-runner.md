# Automated Campaign Runner — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-16-automated-campaign-runner.md`

---

## Step 1 — Extend SavedSegment Model

**Files:** `src/orm/models/segment.py`, `src/orm/models/__init__.py`

Add `mailchimp_tag` and `is_automated` fields to `SavedSegment`. Add `CustomerSegmentMembership` model with composite PK. Register in `__init__.py`.

## Step 2 — Update Segment Schemas

**Files:** `src/orm/schemas/segment.py`

Add `mailchimp_tag` and `is_automated` to `SegmentCreate` and `SegmentResponse`.

## Step 3 — Shared Filter Service

**File:** `src/services/segment_service.py` (new)

Extract `_count_customers_for_filters` logic from `routes/segments.py` into a shared function `get_customer_ids_for_filters()` that returns `set[UUID]`. Refactor the route to use it.

## Step 4 — Campaign Runner Worker

**File:** `src/services/campaign_runner.py` (new)

Implement `CampaignRunner` class with:

- Constructor accepts `engine` (not FastAPI `get_db` — background workers can't use dependency injection)
- `start()` — infinite loop with sleep interval
- `_run_cycle()` — opens `AsyncSession(self.engine)`, fetches automated segments, processes each
- `_process_segment()` — computes enters/exits via set diff, spawns tasks
- `_add_tag()` / `_remove_tag()` — semaphore-limited Mailchimp API calls + DB writes
- Cascade `delete-orphan` on `SavedSegment.memberships` for FK-safe cleanup

## Step 5 — Automation Toggle Endpoint

**File:** `src/routes/segments.py`

Add `PUT /segments/{id}/automate` — sets `is_automated` and `mailchimp_tag`. Returns updated segment.

## Step 6 — Worker Startup

**File:** `src/main.py`

Spawn `CampaignRunner` via `asyncio.create_task()` in lifespan, gated on `settings.mailchimp_api_key`. Cancel on shutdown.

## Step 7 — Verify

```bash
doppler run -- uv run pytest tests/ -q     # 207+ passing
cd apps/admin && npx tsc --noEmit           # clean
```
