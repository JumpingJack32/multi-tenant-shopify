"""Automated campaign runner — segment transitions + scheduled dispatch delivery."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from uuid import UUID

from sqlalchemy import and_, or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.campaign import CampaignTemplate
from src.orm.models.dispatch import CampaignDispatch, CampaignDispatchRecipient, DispatchStatus
from src.orm.models.order import Customer
from src.orm.models.segment import CustomerSegmentMembership, SavedSegment
from src.services.email_service import create_email_service, render_email_template, render_jinja_string
from src.services.segment_service import get_customer_ids_for_filters

logger = logging.getLogger(__name__)

CAMPAIGN_INTERVAL_SECONDS = 300  # 5 minutes (segment membership)
DISPATCH_INTERVAL_SECONDS = 60  # 1 minute (scheduled dispatches)
MAX_CONCURRENCY = 5
DISPATCH_BATCH_SIZE = 100
DISPATCH_MAX_PER_TICK = 5
STALE_PROCESSING_MINUTES = 5


class CampaignRunner:
    """Background worker that evaluates automated segments and delivers scheduled dispatches.
    Runs as an asyncio.create_task() spawned at application startup."""

    def __init__(self, engine, interval_seconds=CAMPAIGN_INTERVAL_SECONDS, max_concurrency=MAX_CONCURRENCY):
        self.engine = engine
        self.interval = interval_seconds
        self.semaphore = asyncio.Semaphore(max_concurrency)
        self.email_service = create_email_service()

    async def start(self):
        """Infinite loop — spawned via asyncio.create_task()."""
        logger.info("Campaign runner started (interval=%ds, concurrency=%d)", self.interval, MAX_CONCURRENCY)
        while True:
            try:
                await self._run_cycle()
            except Exception:
                logger.exception("Campaign runner cycle failed")
            await asyncio.sleep(self.interval)

    async def _run_cycle(self):
        segments_task = self._get_automated_segments()
        dispatches_task = self._get_ready_dispatches()

        segments = await segments_task
        dispatches = await dispatches_task

        for segment in segments:
            try:
                async with AsyncSession(self.engine) as db:
                    await self._process_segment(db, segment)
                    await db.commit()
            except Exception:
                logger.exception("Failed processing segment %s", segment.id)

        for dispatch in dispatches:
            asyncio.create_task(self._send_dispatch(dispatch.id))

    async def _get_automated_segments(self):
        async with AsyncSession(self.engine) as db:
            stmt = select(SavedSegment).where(
                SavedSegment.is_automated == True,  # noqa: E712
            )
            result = await db.exec(stmt)
            return result.all()

    async def _get_ready_dispatches(self):
        async with AsyncSession(self.engine) as db:
            now = datetime.now(timezone.utc)
            stale_threshold = now - timedelta(minutes=STALE_PROCESSING_MINUTES)
            stmt = (
                select(CampaignDispatch)
                .where(
                    or_(
                        and_(
                            CampaignDispatch.status == DispatchStatus.SCHEDULED,
                            CampaignDispatch.scheduled_at <= now,
                        ),
                        and_(
                            CampaignDispatch.status == DispatchStatus.PROCESSING,
                            CampaignDispatch.updated_at <= stale_threshold,
                        ),
                    )
                )
                .with_for_update(skip_locked=True)
                .limit(DISPATCH_MAX_PER_TICK)
            )
            result = await db.exec(stmt)
            return result.all()

    async def _send_dispatch(self, dispatch_id: UUID):
        """Process a single dispatch — streams pending recipients, sends via Resend batch."""
        async with AsyncSession(self.engine) as db:
            dispatch = await db.get(CampaignDispatch, dispatch_id)
            if not dispatch:
                return

            if dispatch.status == DispatchStatus.SCHEDULED:
                dispatch.status = DispatchStatus.PROCESSING
                db.add(dispatch)
                await db.commit()

            stmt = (
                select(CampaignDispatchRecipient)
                .where(
                    CampaignDispatchRecipient.dispatch_id == dispatch.id,
                    CampaignDispatchRecipient.status == "pending",
                )
                .with_for_update(skip_locked=True)
            )
            result = await db.stream(stmt)
            async for chunk in result.yield_per(DISPATCH_BATCH_SIZE):
                recipients = [row[0] for row in chunk]
                if not recipients:
                    continue

                from_email = getattr(self.email_service, "from_email", "marketing@notify.amoagou.com")
                batch_payload = [
                    {
                        "from": from_email,
                        "to": [r.email],
                        "subject": dispatch.name,
                        "html": dispatch.template_html,
                    }
                    for r in recipients
                ]

                try:
                    await self.email_service.send_batch(batch_payload)
                    now = datetime.now(timezone.utc)
                    for r in recipients:
                        r.status = "sent"
                        r.sent_at = now
                    dispatch.sent_count += len(recipients)
                except Exception as exc:
                    for r in recipients:
                        r.status = "failed"
                        r.error_message = str(exc)[:500]
                    dispatch.failed_count += len(recipients)

                db.add(dispatch)
                await db.commit()
                await asyncio.sleep(1.0)

            dispatch.status = DispatchStatus.COMPLETED
            dispatch.completed_at = datetime.now(timezone.utc)
            db.add(dispatch)
            await db.commit()

    async def _process_segment(self, db, segment):
        current = await get_customer_ids_for_filters(db, segment.tenant_id, segment.filters)
        previous = await self._get_previous_members(db, segment.id, segment.tenant_id)

        to_add = current - previous
        to_remove = previous - current

        if not to_add and not to_remove:
            return

        logger.info("Segment %s: %d enters, %d exits", segment.name, len(to_add), len(to_remove))

        for cid in to_add:
            await self._add_customer_tag(db, cid, segment)
        for cid in to_remove:
            await self._remove_customer_tag(db, cid, segment)

    async def _get_previous_members(self, db, segment_id: UUID, tenant_id: UUID) -> set[UUID]:
        stmt = select(CustomerSegmentMembership.customer_id).where(
            CustomerSegmentMembership.segment_id == segment_id,
            CustomerSegmentMembership.tenant_id == tenant_id,
        )
        result = await db.exec(stmt)
        return set(result.all())

    async def _add_customer_tag(self, db, customer_id: UUID, segment):
        async with self.semaphore:
            try:
                stmt = select(Customer).where(Customer.id == customer_id)
                customer = (await db.exec(stmt)).one_or_none()
                if not customer or not customer.email:
                    return

                db.add(CustomerSegmentMembership(
                    customer_id=customer_id,
                    segment_id=segment.id,
                    tenant_id=segment.tenant_id,
                ))

                from src.services.event_publisher import publish as publish_event
                temp_staged = []
                await publish_event("customer.segment.enter", "campaigns", {"customer_id": str(customer_id), "segment_id": str(segment.id), "segment_name": segment.name}, segment.tenant_id, db, temp_staged)

                svc = create_email_service()
                if segment.campaign_template_id:
                    tmpl = await db.get(CampaignTemplate, segment.campaign_template_id)
                    if tmpl:
                        subject = render_jinja_string(tmpl.subject, customer_name=customer.first_name or "Customer")
                        html = render_email_template("campaign-promo", customer_name=customer.first_name or "Customer")
                        asyncio.ensure_future(svc.send_raw(customer.email, subject, html))
                    else:
                        html = render_email_template("campaign-promo", customer_name=customer.first_name or "Customer")
                        asyncio.ensure_future(svc.send_raw(customer.email, f"Welcome to {segment.name}", html))
                else:
                    html = render_email_template("campaign-promo", customer_name=customer.first_name or "Customer")
                    asyncio.ensure_future(svc.send_raw(customer.email, f"Welcome to {segment.name}", html))
            except Exception:
                logger.exception("Failed to process customer %s for segment %s", customer_id, segment.id)

    async def _remove_customer_tag(self, db, customer_id: UUID, segment):
        async with self.semaphore:
            try:
                stmt = select(Customer).where(Customer.id == customer_id)
                customer = (await db.exec(stmt)).one_or_none()
                if not customer or not customer.email:
                    return

                stmt_del = select(CustomerSegmentMembership).where(
                    CustomerSegmentMembership.customer_id == customer_id,
                    CustomerSegmentMembership.segment_id == segment.id,
                )
                membership = (await db.exec(stmt_del)).one_or_none()
                if membership:
                    await db.delete(membership)

                from src.services.event_publisher import publish as publish_event
                temp_staged = []
                await publish_event("customer.segment.exit", "campaigns", {"customer_id": str(customer_id), "segment_id": str(segment.id), "segment_name": segment.name}, segment.tenant_id, db, temp_staged)
            except Exception:
                logger.exception("Failed to remove tag for customer %s segment %s", customer_id, segment.id)
