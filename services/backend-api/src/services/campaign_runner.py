"""Automated campaign runner — detects segment transitions and syncs Mailchimp tags."""

import asyncio
import logging
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.campaign import CampaignTemplate
from src.orm.models.order import Customer
from src.orm.models.segment import CustomerSegmentMembership, SavedSegment
from src.services.email_service import create_email_service, render_email_template, render_jinja_string
from src.services.mailchimp_service import MailchimpConfig, sync_contact
from src.services.segment_service import get_customer_ids_for_filters

logger = logging.getLogger(__name__)

CAMPAIGN_INTERVAL_SECONDS = 300  # 5 minutes
MAX_CONCURRENCY = 5


class CampaignRunner:
    """Background worker that evaluates automated segments and syncs Mailchimp tags.
    Runs as an asyncio.create_task() spawned at application startup."""

    def __init__(self, engine, interval_seconds=CAMPAIGN_INTERVAL_SECONDS, max_concurrency=MAX_CONCURRENCY):
        self.engine = engine
        self.interval = interval_seconds
        self.semaphore = asyncio.Semaphore(max_concurrency)

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
        segments = await self._get_automated_segments()
        if not segments:
            return
        for segment in segments:
            try:
                async with AsyncSession(self.engine) as db:
                    await self._process_segment(db, segment)
                    await db.commit()
            except Exception:
                logger.exception("Failed processing segment %s", segment.id)

    async def _get_automated_segments(self):
        async with AsyncSession(self.engine) as db:
            stmt = select(SavedSegment).where(
                SavedSegment.is_automated == True,  # noqa: E712
                SavedSegment.mailchimp_tag != None,  # noqa: E711
            )
            result = await db.exec(stmt)
            return result.all()

    async def _process_segment(self, db, segment):
        from src.config import settings

        if not settings.mailchimp_api_key or not settings.mailchimp_list_id:
            return

        current = await get_customer_ids_for_filters(db, segment.tenant_id, segment.filters)
        previous = await self._get_previous_members(db, segment.id, segment.tenant_id)

        to_add = current - previous
        to_remove = previous - current

        if not to_add and not to_remove:
            return

        logger.info(
            "Segment %s: %d enters, %d exits",
            segment.name, len(to_add), len(to_remove),
        )

        config = MailchimpConfig(
            api_key=settings.mailchimp_api_key,
            list_id=settings.mailchimp_list_id,
        )

        for cid in to_add:
            await self._add_customer_tag(db, config, cid, segment)
        for cid in to_remove:
            await self._remove_customer_tag(db, config, cid, segment)

    async def _get_previous_members(self, db, segment_id: UUID, tenant_id: UUID) -> set[UUID]:
        stmt = select(CustomerSegmentMembership.customer_id).where(
            CustomerSegmentMembership.segment_id == segment_id,
            CustomerSegmentMembership.tenant_id == tenant_id,
        )
        result = await db.exec(stmt)
        return set(result.all())

    async def _add_customer_tag(self, db, config, customer_id: UUID, segment):
        async with self.semaphore:
            try:
                stmt = select(Customer).where(Customer.id == customer_id)
                customer = (await db.exec(stmt)).one_or_none()
                if not customer or not customer.email:
                    return

                await sync_contact(config, customer.email, "subscribed")

                db.add(CustomerSegmentMembership(
                    customer_id=customer_id,
                    segment_id=segment.id,
                    tenant_id=segment.tenant_id,
                ))

                # Publish segment.enter event
                from src.services.event_publisher import publish as publish_event
                temp_staged = []
                await publish_event("customer.segment.enter", "campaigns", {"customer_id": str(customer_id), "segment_id": str(segment.id), "segment_name": segment.name}, segment.tenant_id, db, temp_staged)

                # Send promotional email after successful tag add
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

    async def _remove_customer_tag(self, db, config, customer_id: UUID, segment):
        async with self.semaphore:
            try:
                stmt = select(Customer).where(Customer.id == customer_id)
                customer = (await db.exec(stmt)).one_or_none()
                if not customer or not customer.email:
                    return

                await sync_contact(config, customer.email, "unsubscribed")

                stmt_del = select(CustomerSegmentMembership).where(
                    CustomerSegmentMembership.customer_id == customer_id,
                    CustomerSegmentMembership.segment_id == segment.id,
                )
                membership = (await db.exec(stmt_del)).one_or_none()
                if membership:
                    await db.delete(membership)

                # Publish segment.exit event
                from src.services.event_publisher import publish as publish_event
                temp_staged = []
                await publish_event("customer.segment.exit", "campaigns", {"customer_id": str(customer_id), "segment_id": str(segment.id), "segment_name": segment.name}, segment.tenant_id, db, temp_staged)
            except Exception:
                logger.exception("Failed to remove tag for customer %s segment %s", customer_id, segment.id)
