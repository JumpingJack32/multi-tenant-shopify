# Campaign Dispatch — Automated Email Delivery

> **Status:** Draft

---

## 1. Value

Connect Unlayer templates to saved segments via the Resend batch API. Marketing users can create a dispatch from any template + segment combination, schedule it, and let the campaign runner process it in the background — closing the marketing loop.

---

## 2. Architecture

```
[ Admin UI ] ──POST /dispatches──> [ CampaignDispatch ] (rows in DB)
                                          │
[ CampaignRunner ] ──poll every 60s──> SELECT ... FOR UPDATE SKIP LOCKED
                                          │
                                          ▼
                              [ Resend Batch API ] ── 100 emails/req
                                          │
                                          ▼
                              [ CampaignDispatchLog ] (per-customer result)
```

---

## 3. Data Models

### `CampaignDispatch`

**File:** `services/backend-api/src/orm/models/dispatch.py` (new)

```python
class DispatchStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class CampaignDispatch(BaseModel, table=True):
    __tablename__ = "campaign_dispatches"

    name: str = Field(max_length=255)
    template_id: UUID = Field(foreign_key="campaign_templates.id", nullable=False)
    segment_id: UUID = Field(foreign_key="saved_segments.id", nullable=False)
    template_html: str = Field(sa_column=Column(Text, nullable=False))
    status: DispatchStatus = Field(default=DispatchStatus.DRAFT)
    scheduled_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    sent_count: int = Field(default=0)
    failed_count: int = Field(default=0)
    total_count: int = Field(default=0)
    completed_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
```

### `CampaignDispatchRecipient`

```python
class CampaignDispatchRecipient(BaseModel, table=True):
    __tablename__ = "campaign_dispatch_recipients"

    dispatch_id: UUID = Field(foreign_key="campaign_dispatches.id", ondelete="CASCADE")
    customer_id: UUID = Field(foreign_key="customers.id", ondelete="SET NULL")
    email: str = Field(max_length=255)
    status: str = Field(default="pending")  # pending | sent | failed
    error_message: str | None = Field(default=None, max_length=500)
    sent_at: datetime | None = Field(default=None, sa_column=Column(DateTime(timezone=True)))
```

---

## 4. State Machine

```
DRAFT ──(schedule)──> SCHEDULED ──(picker picks it up)──> PROCESSING ──(all sent)──> COMPLETED
                           │                                    │
                           └──(cancel)──> DRAFT                 └──(error)──> FAILED
```

---

## 5. API Endpoints

All mounted on `marketing_templates_router` at `/api/v1/`.

### `POST /dispatches`

Create a dispatch. Compiles the template HTML at creation time (snapshot) so subsequent template edits don't retroactively change sent campaigns.

**Payload:**

```json
{
  "name": "VIP Summer Sale",
  "template_id": "uuid",
  "segment_id": "uuid",
  "scheduled_at": "2026-07-25T09:00:00Z"
}
```

**Flow:**

1. Load `CampaignTemplate` by `template_id` → copy `body_html` as `template_html`
2. Load `SavedSegment` by `segment_id` → compute customer count
3. Create `CampaignDispatch` with `status=DRAFT`, `total_count=count`
4. Insert `CampaignDispatchRecipient` rows via a single `INSERT INTO ... SELECT` SQL statement (avoids Python OOM for 10k+ segments)
5. If `scheduled_at` is set, transition to `SCHEDULED`. If omitted ("Send Now"), set `scheduled_at = datetime.now(timezone.utc)` so it's picked up on the next runner tick.

### `GET /dispatches`

List dispatches for tenant with status filter and pagination.

### `GET /dispatches/{id}`

Dispatch detail with stats (sent, failed, pending counts, progress).

### `POST /dispatches/{id}/schedule`

Set `scheduled_at` and transition `DRAFT → SCHEDULED`.

### `POST /dispatches/{id}/cancel`

Cancel a `SCHEDULED` dispatch — transition back to `DRAFT`.

---

## 6. Campaign Runner — Dispatch Processing

**File:** `services/backend-api/src/services/campaign_runner.py` (extend existing runner)

The existing `CampaignRunner.start()` loop runs every 60s. Add a parallel method `_process_dispatches` that:

1. **SELECT ... FOR UPDATE SKIP LOCKED** on `CampaignDispatch` WHERE `status = 'scheduled'` AND `scheduled_at <= now()`
2. Transition status to `PROCESSING`
3. Stream recipients via `yield_per(100)` with `FOR UPDATE SKIP LOCKED` on the recipient rows
4. Build batches of 100, send via Resend batch API
5. On success per batch: update recipient rows to `status = 'sent'`, increment `sent_count`
6. On failure per batch: increment `failed_count`, store error message
7. After all batches: transition to `COMPLETED`

**Rate limiting:** Batches of 100, 1-second pause between batches. Uses the existing `asyncio.Semaphore` from the campaign runner.

---

## 7. CampaignRunner Integration

```python
# In existing CampaignRunner.start() loop:
async def _process_dispatches(self, db):
stmt = (
    select(CampaignDispatch)
    .where(
        or_(
            # Normal: pick up scheduled dispatches that are due
            and_(
                CampaignDispatch.status == DispatchStatus.SCHEDULED,
                CampaignDispatch.scheduled_at <= datetime.now(timezone.utc),
            ),
            # Recovery: pick up stalled PROCESSING dispatches older than 5 minutes
            and_(
                CampaignDispatch.status == DispatchStatus.PROCESSING,
                CampaignDispatch.updated_at
                <= datetime.now(timezone.utc) - timedelta(minutes=5),
            ),
        )
    )
    .with_for_update(skip_locked=True)
    .limit(5)
)
    dispatches = (await db.exec(stmt)).all()
    for dispatch in dispatches:
        asyncio.create_task(self._send_dispatch(dispatch))
```

---

## 8. Resend Batch Integration

**File:** `services/backend-api/src/services/email_service.py`

Add a `send_batch` method to `ResendEmailService`:

```python
async def send_batch(self, emails: list[dict]) -> list[bool]:
    """Send up to 100 emails via Resend batch API."""
    # POST https://api.resend.com/emails/batch
    # Returns list of { id, email } per recipient
```

---

## 9. Risks & Mitigations

| Risk                                       | Mitigation                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Template edits affect in-flight dispatches | `template_html` is snapshotted at creation time — no retroactive changes                                    |
| Dispatching to unsubscribed customers      | Only dispatch to `email_subscription_status == "subscribed"`                                                |
| Resend rate limits (30 req/s)              | Batch at 100 emails/req, 1s pause between batches — well within limits                                      |
| Crash mid-dispatch                         | Recipient rows track per-customer status. On restart, `PROCESSING` dispatches can be re-scanned and resumed |
| Duplicate dispatch processing              | `FOR UPDATE SKIP LOCKED` prevents multiple runner instances picking the same dispatch                       |
| Large segment (10k+)                       | Streaming via `yield_per(100)` avoids loading all customers into memory                                     |

---

## 10. Files Changed

| File                                                     | Change                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------- |
| `services/backend-api/src/orm/models/dispatch.py`        | **New** — CampaignDispatch + CampaignDispatchRecipient models |
| `services/backend-api/src/orm/schemas/dispatch.py`       | **New** — Pydantic schemas                                    |
| `services/backend-api/src/routes/marketing_templates.py` | Add `/dispatches/*` endpoints                                 |
| `services/backend-api/src/services/campaign_runner.py`   | Extend with `_process_dispatches` + `_send_dispatch`          |
| `services/backend-api/src/services/email_service.py`     | Add `send_batch` method                                       |
| `services/backend-api/alembic/versions/...`              | **New** migration for dispatch tables                         |
| `apps/admin/src/lib/api/client.ts`                       | Add dispatch API methods                                      |
| `apps/admin/src/features/marketing/hooks/`               | Add dispatch hooks                                            |
| `apps/admin/src/components/marketing/`                   | Dispatch list/create UI                                       |
