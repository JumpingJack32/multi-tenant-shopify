"""Event bus — outbox pattern event publishing with fan-out delivery."""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
from uuid import UUID

import httpx
from sqlalchemy import text
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.event import Event
from src.orm.models.webhook import WebhookDeliveryAttempt, WebhookSubscriber

logger = logging.getLogger(__name__)


class EventBus:
    """Transactional outbox event bus with fan-out delivery to subscribers."""

    def __init__(self, engine):
        self.engine = engine
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

    async def start(self):
        """Background worker — recovers crashed events, then consumes new ones."""
        # 1. Recovery sweep on boot — pull undelivered DB events into the queue
        async with AsyncSession(self.engine) as db:
            undelivered = (await db.exec(
                select(Event).where(Event.delivered == False)  # noqa: E712
            )).all()
            for event in undelivered:
                await self._queue.put(event)

        # 2. Continuous consumer loop
        while True:
            event = await self._queue.get()
            asyncio.create_task(self._dispatch_event(event))
            self._queue.task_done()

    async def _dispatch_event(self, event: Event):
        """Fetch matching subscribers and fan out delivery tasks concurrently."""
        async with AsyncSession(self.engine) as db:
            stmt = select(Event).where(Event.id == event.id)
            event_record = (await db.exec(stmt)).one()

            sub_stmt = select(WebhookSubscriber).where(
                WebhookSubscriber.tenant_id == event_record.tenant_id,
                WebhookSubscriber.is_active == True,  # noqa: E712
            )
            subscribers = (await db.exec(sub_stmt)).all()
            matching = [s for s in subscribers if event_record.event_type in s.event_types]

            if not matching:
                event_record.delivered = True
                db.add(event_record)
                await db.commit()
                return

            for subscriber in matching:
                asyncio.create_task(self._deliver_to_subscriber(event_record.id, subscriber.id))

    async def _deliver_to_subscriber(self, event_id: UUID, subscriber_id: UUID):
        """Deliver a single event to a single subscriber. Runs in its own task."""
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


@asynccontextmanager
async def outbox_context(db: AsyncSession, event_bus: EventBus):
    """Context manager that automatically flushes staged events after commit.
    If the block raises an exception, flush is skipped — preventing ghost events."""
    staged: list[Event] = []

    async def publish(event_type: str, source: str, data: dict, tenant_id: UUID):
        await event_bus.publish(event_type, source, data, tenant_id, db, staged)

    yield publish

    # Only reaches here if no exception was raised in the async with block
    await event_bus.flush(staged)


async def resolve_delivered_flags(db: AsyncSession):
    """Batch-update events to delivered when all subscribers have a successful attempt."""
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


async def _resolve_delivered_loop(engine):
    """Periodic sweep to resolve delivered flags."""
    while True:
        await asyncio.sleep(60)
        try:
            async with AsyncSession(engine) as db:
                await resolve_delivered_flags(db)
                await db.commit()
        except Exception:
            logger.exception("Failed to resolve delivered flags")
