# Automated Campaign Runner — Specification

> **Status:** Draft  
> **Based on:** Customer Management Hub (Phases 1–4), existing `asyncio.create_task()` worker pattern

---

## 1. Overview

Automatically detect when customers enter or exit saved segments and sync a corresponding Mailchimp tag. No campaign-builder UI, no email template editor — just threshold-based tag management that Mailchimp Customer Journeys can react to.

**Example:** A saved segment `"VIP"` with filters `{"min_spent": 100000}` (i.e., £1,000 in pence). When a customer's total_spent crosses £1,000, the runner adds a `VIP` tag in Mailchimp. If they later fall below (via refund), the tag is removed.

---

## 2. Data Model Changes

### 2.1 Extend `SavedSegment`

Add two nullable fields to the existing `SavedSegment` model (`src/orm/models/segment.py`):

```python
mailchimp_tag: str | None = Field(default=None, max_length=100)
is_automated: bool = Field(default=False)
```

- `mailchimp_tag` — the Mailchimp tag name to apply/remove (e.g., `"VIP"`, `"High-Spender"`). When null, the segment is not synced.
- `is_automated` — opt-in flag; segments must explicitly be marked as automated to be picked up by the worker.

### 2.2 New Model: `CustomerSegmentMembership`

Tracks which customers are currently in which segment. Enables set-differential detection (enters vs exits).

```python
class CustomerSegmentMembership(BaseModel, table=True):
    __tablename__ = "customer_segment_memberships"
    customer_id: UUID = Field(foreign_key="customers.id", primary_key=True)
    segment_id: UUID = Field(foreign_key="saved_segments.id", primary_key=True)
    joined_at: datetime
```

Inherits `id`, `tenant_id`, `created_at`, `updated_at` from `BaseModel` for tenant isolation. The composite PK `(customer_id, segment_id)` prevents duplicate membership entries and makes set queries fast.

Add a cascade relationship on `SavedSegment` so deleting a segment cleans up its memberships:

```python
# On SavedSegment
memberships: list["CustomerSegmentMembership"] = Relationship(
    back_populates="segment",
    sa_relationship_kwargs={"cascade": "all, delete-orphan"},
)
```

### 2.3 Registration

Add `CustomerSegmentMembership` to `src/orm/models/__init__.py`.

---

## 3. Backend: Shared Filter Logic

**File:** `src/services/segment_service.py` (new)

Extract the filter-application logic from `routes/segments.py._count_customers_for_filters()` into a shared service that returns **customer IDs** instead of just a count:

```python
async def get_customer_ids_for_filters(
    db: AsyncSession,
    tenant_id: UUID,
    filters: dict,
) -> set[UUID]:
    """Return set of customer IDs matching segment filter criteria."""
    stmt = select(Customer.id).where(Customer.tenant_id == tenant_id)
    # apply same filter logic as _count_customers_for_filters
    ...
    result = await db.exec(stmt)
    return set(result.all())
```

This is used by both the segments CRUD (for count) and the campaign runner (for membership evaluation).

---

## 4. Backend: Background Worker

**File:** `src/services/campaign_runner.py` (new)

Follows the existing `asyncio.create_task()` pattern from `abandoned_cart.py`.

**Important:** The worker cannot use FastAPI's `get_db` dependency generator — that only works inside request handlers. Create an `AsyncSession` directly from the engine, matching `abandoned_cart.py`.

```python
from sqlalchemy.ext.asyncio import AsyncSession

class CampaignRunner:
    def __init__(
        self,
        engine,
        interval_seconds=300,
        max_concurrency=5,
    ):
        self.engine = engine
        self.interval = interval_seconds
        self.semaphore = asyncio.Semaphore(max_concurrency)

    async def start(self):
        while True:
            try:
                await self._run_cycle()
            except Exception:
                logger.exception("Campaign runner cycle failed")
            await asyncio.sleep(self.interval)

    async def _run_cycle(self):
        async with AsyncSession(self.engine) as db:
            segments = await self._get_automated_segments(db)
            for segment in segments:
                await self._process_segment(db, segment)

    async def _get_automated_segments(self, db):
        stmt = select(SavedSegment).where(
            SavedSegment.is_automated == True,
            SavedSegment.mailchimp_tag != None,
        )
        result = await db.exec(stmt)
        return result.all()

    async def _process_segment(self, db, segment):
        current = await get_customer_ids_for_filters(db, segment.tenant_id, segment.filters)
        previous = await self._get_previous_members(db, segment.id, segment.tenant_id)

        to_add = current - previous
        to_remove = previous - current

        if not to_add and not to_remove:
            return

        tasks = []
        for cid in to_add:
            tasks.append(self._add_tag(db, cid, segment))
        for cid in to_remove:
            tasks.append(self._remove_tag(db, cid, segment))

        await asyncio.gather(*tasks)
        await db.commit()

    async def _get_previous_members(self, db, segment_id, tenant_id):
        stmt = select(CustomerSegmentMembership.customer_id).where(
            CustomerSegmentMembership.segment_id == segment_id,
            CustomerSegmentMembership.tenant_id == tenant_id,
        )
        result = await db.exec(stmt)
        return set(result.all())
```

### Concurrent Execution

- `asyncio.Semaphore(max_concurrency=5)` limits simultaneous Mailchimp API calls
- Each customer's tag update is wrapped in `try/except` — one failure doesn't block others

---

## 5. Backend: Worker Startup

**File:** `src/main.py`

Add to the existing `_abandoned_cart_worker` startup pattern:

```python
_campaign_runner_task: asyncio.Task | None = None

@asynccontextmanager
async def lifespan(app):
    global _campaign_runner_task
    if settings.mailchimp_api_key:
        from src.database import async_engine
        runner = CampaignRunner(async_engine)
        _campaign_runner_task = asyncio.create_task(runner.start())
    yield
    if _campaign_runner_task:
        _campaign_runner_task.cancel()
```

Worker only activates when `MAILCHIMP_API_KEY` is configured — no-op in dev/test otherwise.

---

## 6. API: Segment Automation Toggle

**File:** `src/routes/segments.py`

Add `PUT /segments/{id}/automate` to enable/disable automation and set the Mailchimp tag.

**Validation:** If `is_automated` is `True`, `mailchimp_tag` must be non-empty. Use a Pydantic model validator:

```python
@model_validator(mode="after")
def validate_automation(self):
    if self.is_automated and not self.mailchimp_tag:
        raise ValueError("A Mailchimp tag is required to enable automation.")
    return self
```

Request body:

```json
Request Body:
{
  "is_automated": true,
  "mailchimp_tag": "VIP"
}

Response:
{
  "id": "...",
  "name": "High Spenders",
  "is_automated": true,
  "mailchimp_tag": "VIP",
  "customer_count": 12
}
```

---

## 7. No Frontend Changes

The automation toggle is configured server-side via API. The Mailchimp tag sync is fully background — no new UI components needed. Existing Mailchimp sync status in the drawer continues to show per-customer sync state.

---

## 8. Files Changed

| File                              | Change                                               |
| --------------------------------- | ---------------------------------------------------- |
| `src/orm/models/segment.py`       | Add `mailchimp_tag`, `is_automated` fields           |
| `src/orm/models/segment.py`       | Add `CustomerSegmentMembership` model                |
| `src/orm/models/__init__.py`      | Export new model                                     |
| `src/orm/schemas/segment.py`      | Add automation fields to schemas                     |
| `src/services/segment_service.py` | **New** — shared filter logic returning customer IDs |
| `src/services/campaign_runner.py` | **New** — background worker loop                     |
| `src/routes/segments.py`          | Add `PUT /segments/{id}/automate` endpoint           |
| `src/main.py`                     | Spawn campaign runner on startup                     |
| `tests/test_campaign_runner.py`   | **New** — unit tests for worker logic                |

---

## 9. Risks & Mitigations

| Risk                                                     | Mitigation                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Worker marks tag added before Mailchimp API succeeds     | Tag added to DB only after successful API call; on crash, next cycle re-processes     |
| Mailchimp rate limits (10 simultaneous connections)      | `Semaphore(5)` ensures max 5 concurrent requests, well under the limit                |
| Segments with very large member sets (10k+)              | `asyncio.gather` handles throughput; no upper limit needed for expected scale         |
| Duplicate tag adds if Mailchimp already has the tag      | Mailchimp Tags API is idempotent — adding an existing tag is a no-op                  |
| Worker runs during a filter criteria update on a segment | The next cycle picks up the new definition; stale memberships are corrected naturally |
