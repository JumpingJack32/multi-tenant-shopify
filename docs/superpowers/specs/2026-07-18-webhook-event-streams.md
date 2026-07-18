# Webhook & Event Streams — Specification

> **Status:** Draft  
> **Prerequisites:** Order lifecycle, fulfillment service, campaign runner

---

## 1. Architecture

A publisher/subscriber pattern where domain events are emitted by services and delivered to registered webhook endpoints.

```
Service (publisher) → Event Bus (in-memory) → Dispatch Worker → HTTP POST → Subscriber
                           │
                           └→ Event Log (DB) — audit trail, retry queue
```

- **No external message broker** — follows the existing `asyncio.create_task()` pattern
- **Events are logged to DB** — enables retry, audit, and debugging
- **Delivery is async** — never blocks the publisher

---

## 2. Event Model

**File:** `src/orm/models/event.py`

```python
class Event(BaseModel, table=True):
    __tablename__ = "events"
    event_type: str = Field(max_length=100, index=True)  # e.g. "order.paid"
    source: str = Field(max_length=50)                    # e.g. "orders", "fulfillment"
    data: dict = Field(default_factory=dict, sa_column=Column(JSON))
    delivered: bool = Field(default=False)
    delivered_at: datetime | None = None
    retry_count: int = Field(default=0)
    last_error: str | None = None
```

## 3. Webhook Subscriber Model

**File:** `src/orm/models/webhook.py`

```python
class WebhookSubscriber(BaseModel, table=True):
    __tablename__ = "webhook_subscribers"
    url: str = Field(max_length=2048)
    secret: str | None = None                        # HMAC signing secret
    event_types: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_active: bool = Field(default=True)
    last_sent_at: datetime | None = None
    last_status_code: int | None = None


class WebhookDeliveryAttempt(BaseModel, table=True):
    __tablename__ = "webhook_delivery_attempts"
    event_id: UUID = Field(foreign_key="events.id", index=True)
    subscriber_id: UUID = Field(foreign_key="webhook_subscribers.id", index=True)
    status_code: int | None = None
    success: bool = Field(default=False)
    error_message: str | None = None
```

---

## 4. Event Bus + Outbox Pattern

**File:** `src/services/event_bus.py` (new)

Events are written to the DB inside the publisher's transaction. The in-memory queue only receives events after the DB commit succeeds — preventing ghost events on transaction rollback.

````python
class EventBus:
    def __init__(self):
        self._queue: asyncio.Queue[Event] = asyncio.Queue()

    async def publish(self, event_type: str, source: str, data: dict, tenant_id: UUID, db: AsyncSession, staged: list):
        """Write event to DB inside the caller's transaction.
        staged is a request-scoped list owned by the caller — never stored on the singleton."""
        event = Event(event_type=event_type, source=source, data=data, tenant_id=tenant_id)
        db.add(event)
        staged.append(event)

    async def flush(self, staged: list):
        """After DB commit succeeds, push staged events to the in-memory queue."""
        while staged:
            event = staged.pop(0)
            await self._queue.put(event)
Add a delivery attempt model for race-safe concurrent logging:

```python
class WebhookDeliveryAttempt(BaseModel, table=True):
    __tablename__ = "webhook_delivery_attempts"
    event_id: UUID = Field(foreign_key="events.id", index=True)
    subscriber_id: UUID = Field(foreign_key="webhook_subscribers.id", index=True)
    status_code: int | None = None
    success: bool = Field(default=False)
    error_message: str | None = None
````

Each `_deliver_to_subscriber` writes its own attempt row — concurrent tasks never contend over the same DB row:

```python
async def _deliver_to_subscriber(self, event_id: UUID, subscriber_id: UUID):
    """Deliver a single event to a single subscriber. Runs in its own task.
    Each attempt writes its own WebhookDeliveryAttempt row — no shared-state contention."""
    async with AsyncSession(self.engine) as db:
        event = (await db.exec(select(Event).where(Event.id == event_id))).one()
        sub = (await db.exec(select(WebhookSubscriber).where(WebhookSubscriber.id == subscriber_id))).one()

        payload = {
            "event_type": event.event_type,
            "source": event.source,
            "data": event.data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        body = json.dumps(payload, sort_keys=True, separators=(",", ":"))

        signature = hmac.new(sub.secret.encode(), body.encode("utf-8"), hashlib.sha256).hexdigest() if sub.secret else ""

        attempt = WebhookDeliveryAttempt(event_id=event_id, subscriber_id=subscriber_id)
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    sub.url, content=body,
                    headers={"X-Webhook-Signature": signature, "Content-Type": "application/json"},
                )
            attempt.status_code = response.status_code
            attempt.success = response.status_code < 400
            sub.last_status_code = response.status_code
            sub.last_sent_at = datetime.now(timezone.utc)
            db.add(sub)
        except Exception as e:
            attempt.success = False
            attempt.error_message = str(e)

        db.add(attempt)
        await db.commit()
```

    async def start(self):
        """Background worker — recovers crashed events, then consumes new ones."""
        # 1. Recovery sweep on boot — pull undelivered DB events into the queue
        async with AsyncSession(self.engine) as db:
            undelivered = (await db.exec(
                select(Event).where(Event.delivered == False)
            )).all()
            for event in undelivered:
                await self._queue.put(event)

        # 2. Continuous consumer loop
        while True:
            event = await self._queue.get()
            asyncio.create_task(self._dispatch_event(event))
            self._queue.task_done()

````

---

## 5. Dispatch Worker (Fan-Out Per Subscriber)

**File:** `src/services/event_bus.py`

Each subscriber dispatch runs in its own `asyncio.create_task()` — one slow endpoint cannot block the rest.

```python
async def _dispatch_event(self, event: Event):
    async with AsyncSession(self.engine) as db:
        # Refresh event from DB
        stmt = select(Event).where(Event.id == event.id)
        event = (await db.exec(stmt)).one()

        # Fetch matching subscribers
        sub_stmt = select(WebhookSubscriber).where(
            WebhookSubscriber.tenant_id == event.tenant_id,
            WebhookSubscriber.is_active == True,
        )
        subscribers = (await db.exec(sub_stmt)).all()
        matching = [s for s in subscribers if event.event_type in s.event_types]

        if not matching:
            event.delivered = True
            await db.commit()
            return

        # Fan-out per subscriber — each delivery runs in its own task
        for subscriber in matching:
            asyncio.create_task(self._deliver_to_subscriber(event.id, subscriber.id))
````

---

## 6. Publisher Integration Points

| Event                    | Publisher                               | When                                      |
| ------------------------ | --------------------------------------- | ----------------------------------------- |
| `order.confirmed`        | `OrderLifecycleService.confirm()`       | After status change + inventory deduction |
| `order.paid`             | `OrderLifecycleService.mark_paid()`     | After payment confirmed                   |
| `order.shipped`          | `FulfillmentService.update_tracking()`  | On TRANSIT status                         |
| `order.delivered`        | `FulfillmentService.update_tracking()`  | On DELIVERED status                       |
| `order.cancelled`        | `OrderLifecycleService.cancel()`        | After cancellation                        |
| `order.refunded`         | `OrderLifecycleService.refund()`        | After refund + store credit issued        |
| `customer.segment.enter` | `CampaignRunner._add_customer_tag()`    | When customer enters a segment            |
| `customer.segment.exit`  | `CampaignRunner._remove_customer_tag()` | When customer exits a segment             |

Example publisher call (always within a DB transaction, flush after commit):

```python
# Inside a service method:
staged: list[Event] = []

await event_bus.publish(
    event_type="order.paid",
    source="orders",
    data={"order_id": str(order.id), "order_number": order.order_number, "total": order.total},
    tenant_id=tenant_id,
    db=db,
    staged=staged,
)
# ... other DB operations ...
await db.commit()

# After commit succeeds, push staged events to the in-memory queue:
await event_bus.flush(staged)
```

---

## 7. Admin API

| Method   | Endpoint                   | Description                      |
| -------- | -------------------------- | -------------------------------- |
| `POST`   | `/admin/webhooks`          | Register a subscriber            |
| `GET`    | `/admin/webhooks`          | List subscribers                 |
| `PUT`    | `/admin/webhooks/{id}`     | Update subscriber                |
| `DELETE` | `/admin/webhooks/{id}`     | Remove subscriber                |
| `GET`    | `/admin/events`            | List recent events (audit trail) |
| `POST`   | `/admin/events/{id}/retry` | Manually retry a failed event    |

---

## 8. Delivered Flag Resolution

The `Event.delivered` flag is never set to `True` by subscriber delivery tasks (since concurrent writes to a single row would race). Instead, a lightweight periodic sweep resolves it:

```python
async def _resolve_delivered_flag(db: AsyncSession):
    """Mark events as delivered when all matching subscribers have a successful attempt."""
    await db.execute(text("""
        UPDATE events SET delivered = TRUE, delivered_at = NOW()
        WHERE delivered = FALSE
          AND NOT EXISTS (
              SELECT 1 FROM webhook_subscribers ws
              WHERE ws.tenant_id = events.tenant_id AND ws.is_active = TRUE
                AND events.event_type = ANY(ws.event_types)
                AND NOT EXISTS (
                    SELECT 1 FROM webhook_delivery_attempts wda
                    WHERE wda.event_id = events.id AND wda.subscriber_id = ws.id AND wda.success = TRUE
                )
          )
    """))
```

Run as a background coroutine every 60 seconds.

## 9. Context Manager for Staged Events

**File:** `src/services/event_bus.py`

Instead of requiring every service method to manually create a `staged` list and call `flush()`, provide a context manager that handles it automatically.

**Exception safety:** Python's `@asynccontextmanager` stops execution at the `yield` if an exception is raised inside the `async with` block — the `await event_bus.flush(staged)` line is **never reached** on error. This guarantees events are only flushed after a successful commit.

```python
@asynccontextmanager
async def outbox_context(db: AsyncSession, event_bus: EventBus):
    """Context manager that automatically flushes staged events after commit."""
    staged: list[Event] = []

    async def publish(event_type: str, source: str, data: dict, tenant_id: UUID):
        await event_bus.publish(event_type, source, data, tenant_id, db, staged)

    yield publish  # service uses this to publish events

    # After the service's db.commit() succeeds, flush to queue
    await event_bus.flush(staged)
```

Usage in a service:

```python
async with outbox_context(db, event_bus) as publish:
    await publish("order.paid", "orders", {...}, tenant_id)
    order.status = OrderStatus.PAID
    db.add(order)
    await db.commit()
# staged events are flushed automatically here
```

## 10. Startup

**File:** `src/main.py`

```python
from src.services.event_bus import EventBus

event_bus = EventBus()
_event_bus_task = asyncio.create_task(event_bus.start())
_delivery_resolver_task = asyncio.create_task(_delivery_resolver_loop())
```

---

## 9. Files Changed

| File                                  | Change                                     |
| ------------------------------------- | ------------------------------------------ |
| `src/orm/models/event.py`             | **New** — `Event` model                    |
| `src/orm/models/webhook.py`           | **New** — `WebhookSubscriber` model        |
| `src/orm/models/__init__.py`          | Export new models                          |
| `src/services/event_bus.py`           | **New** — `EventBus` with queue + dispatch |
| `src/services/order_lifecycle.py`     | Publish events on transitions              |
| `src/services/fulfillment_service.py` | Publish events on tracking updates         |
| `src/services/campaign_runner.py`     | Publish events on segment enter/exit       |
| `src/routes/admin_webhooks.py`        | **New** — subscriber CRUD                  |
| `src/main.py`                         | Start event bus worker                     |

---

## 10. Risks

| Risk                                       | Mitigation                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Event bus loses events on crash            | Events are persisted to DB before dispatch; worker picks up undelivered events on restart  |
| `db.new` cleared after commit              | Events staged in request-scoped list before commit, not stored on singleton                |
| Slow subscriber blocks other subscribers   | Per-subscriber `asyncio.create_task()` — one slow endpoint never delays another            |
| Concurrent tasks overwrite event.delivered | `WebhookDeliveryAttempt` table — each task writes its own row, no shared-state contention  |
| Cross-tenant staging contamination         | `staged` list passed through request scope, never stored on singleton EventBus             |
| Subscriber goes down                       | Retry with exponential backoff; dead-letter after 5 retries                                |
| Slow subscriber blocks queue               | Fan-out via `asyncio.create_task()` — each subscriber dispatch runs independently          |
| HMAC signature mismatch across languages   | Deterministic JSON with `sort_keys=True, separators=(",", ":")`                            |
| Ghost event on transaction rollback        | Outbox pattern — event written to DB inside transaction; only pushed to queue after commit |
| Secret key management                      | `WebhookSubscriber.secret` stored hashed or encrypted; never logged                        |
