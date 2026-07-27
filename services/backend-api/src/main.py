import asyncio
from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.core.cache import redis_client
from src.core.exchange_rates.service import RateService
from src.core.pricing.middleware import CurrencyExtractorMiddleware
from src.core.tenant_isolation import reset_tenant_context, setup_tenant_isolation
from src.database import async_engine, init_db

logger = logging.getLogger(__name__)

# Sentry (early init to capture startup errors)
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.httpx import HttpxIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[FastApiIntegration(), HttpxIntegration()],
        traces_sample_rate=0.1,
        environment=settings.app_env or "development",
        send_default_pii=False,
    )

_exchange_rate_task: asyncio.Task | None = None
_abandoned_cart_task: asyncio.Task | None = None
_campaign_runner_task: asyncio.Task | None = None
_event_bus_task: asyncio.Task | None = None
event_bus: "EventBus" | None = None  # type: ignore[name-defined]


async def _exchange_rate_refresh_worker():
    """Background worker that refreshes exchange rates periodically."""
    while True:
        try:
            from sqlmodel.ext.asyncio.session import AsyncSession

            svc = RateService()
            async with AsyncSession(async_engine) as session:
                await svc.refresh_rates(session)
        except Exception:
            logger.exception("Failed to refresh exchange rates")

        await asyncio.sleep(settings.exchange_rate_refresh_hours * 3600)


async def _scheduled_campaign_worker(engine):
    """Check for scheduled campaign templates every 60 seconds."""
    while True:
        await asyncio.sleep(60)
        try:
            from sqlalchemy import text
            from sqlmodel.ext.asyncio.session import AsyncSession

            async with AsyncSession(engine) as db:
                result = await db.execute(
                    text("""
                        SELECT id FROM campaign_templates
                        WHERE send_at <= NOW() AND last_sent_at IS NULL AND is_active = true
                        LIMIT 1 FOR UPDATE SKIP LOCKED
                    """)
                )
                row = result.fetchone()
                if row:
                    template_id = row[0]
                    # Stamp as sent and trigger campaign cycle
                    await db.execute(
                        text("UPDATE campaign_templates SET last_sent_at = NOW() WHERE id = :id"),
                        {"id": template_id},
                    )
                    await db.commit()
                    logger.info("Scheduled campaign %s triggered", template_id)
        except Exception:
            logger.exception("Scheduled campaign worker error")


async def _abandoned_cart_worker():
    """Background worker that sends abandoned cart reminder emails every 15 min."""
    while True:
        try:
            from sqlmodel.ext.asyncio.session import AsyncSession

            from src.services.abandoned_cart import AbandonedCartService
            from src.services.email_service import create_email_service

            email_service = create_email_service()
            async with AsyncSession(async_engine) as session:
                svc = AbandonedCartService(session, email_service)
                count = await svc.process_abandoned_carts()
                if count:
                    logger.info("Abandoned cart worker: %d reminders sent", count)
        except Exception:
            logger.exception("Abandoned cart worker error")

        await asyncio.sleep(900)  # 15 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup and cleanup on shutdown."""
    global _exchange_rate_task, _abandoned_cart_task

    # Validate config
    _ = settings.database_url
    _ = settings.redis_url
    _ = settings.clerk_secret_key
    
    # Only validate if enabled
    if settings.stripe_enabled:
        _ = settings.stripe_secret_key
        _ = settings.stripe_webhook_secret

    # Initialize database
    await init_db()

    # Set up tenant isolation event listeners (once at startup)
    setup_tenant_isolation()

    # Verify Redis connection
    if settings.redis_enabled:
        connected = await redis_client.ping()
        if not connected:
            settings.redis_enabled = False

    # Initialize task refs as locals (prevents UnboundLocalError when conditions skip assignment)
    _exchange_rate_task = None
    _abandoned_cart_task = None
    _campaign_runner_task = None

    # Start exchange rate background refresh
    if settings.redis_enabled:
        _exchange_rate_task = asyncio.create_task(_exchange_rate_refresh_worker())

    # Start abandoned cart background worker
    _abandoned_cart_task = asyncio.create_task(_abandoned_cart_worker())

    # Start campaign runner for automated segment processing
    from src.services.campaign_runner import CampaignRunner

    _campaign_runner_task = asyncio.create_task(
        CampaignRunner(async_engine).start()
    )

    # Start event bus worker
    from src.services.event_bus import _resolve_delivered_loop, EventBus

    global event_bus
    event_bus = EventBus(async_engine)
    _event_bus_task = asyncio.create_task(event_bus.start())
    asyncio.create_task(_resolve_delivered_loop(async_engine))

    # Start scheduled campaign worker
    asyncio.create_task(_scheduled_campaign_worker(async_engine))

    yield

    # Cleanup
    if _exchange_rate_task:
        _exchange_rate_task.cancel()
        try:
            await _exchange_rate_task
        except asyncio.CancelledError:
            pass
    if _abandoned_cart_task:
        _abandoned_cart_task.cancel()
        try:
            await _abandoned_cart_task
        except asyncio.CancelledError:
            pass
    if _campaign_runner_task:
        _campaign_runner_task.cancel()
        try:
            await _campaign_runner_task
        except asyncio.CancelledError:
            pass
    if _event_bus_task:
        _event_bus_task.cancel()
        try:
            await _event_bus_task
        except asyncio.CancelledError:
            pass
    await redis_client.close()

app = FastAPI(
    title="Multi-Tenant Shopify API",
    version="0.1.0",
    lifespan=lifespan,
)

origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
has_wildcard = "*" in origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=not has_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Tenant-ID"],
)


app.add_middleware(CurrencyExtractorMiddleware)

@app.middleware("http")
async def tenant_isolation_middleware(request: Request, call_next):
    """Reset tenant context for each request."""
    reset_tenant_context()
    response = await call_next(request)
    reset_tenant_context()
    return response

from src.core.exchange_rates.router import router as exchange_rates_router  # noqa: E402
from src.routes.admin import router as admin_router  # noqa: E402
from src.routes.admin_auth import router as admin_auth_router  # noqa: E402
from src.routes.admin_fulfillments import router as admin_fulfillments_router  # noqa: E402
from src.routes.admin_dashboard import router as admin_dashboard_router  # noqa: E402
from src.routes.admin_orders import router as admin_orders_router  # noqa: E402
from src.routes.admin_shipping import router as admin_shipping_router  # noqa: E402
from src.routes.admin_webhooks import router as admin_webhooks_router  # noqa: E402
from src.routes.ai import router as ai_router  # noqa: E402
from src.routes.analytics import router as analytics_router  # noqa: E402
from src.routes.auth import router as auth_router  # noqa: E402
from src.routes.categories import router as categories_router  # noqa: E402
from src.routes.collections import router as collections_router  # noqa: E402
from src.routes.customers import router as customers_router  # noqa: E402
from src.routes.inventory import router as inventory_router  # noqa: E402
from src.routes.marketing_templates import router as marketing_templates_router  # noqa: E402
from src.routes.media import router as media_router  # noqa: E402
from src.routes.navigation import router as navigation_router  # noqa: E402
from src.routes.navigation_admin import router as navigation_admin_router  # noqa: E402
from src.routes.orders import router as orders_router  # noqa: E402
from src.routes.product_images import router as product_images_router  # noqa: E402
from src.routes.products import router as products_router  # noqa: E402
from src.routes.public import router as public_router  # noqa: E402
from src.routes.promotions import router as promotions_router  # noqa: E402
from src.routes.purchase_orders import router as purchase_orders_router  # noqa: E402
from src.routes.reviews import router as reviews_router  # noqa: E402
from src.routes.segments import router as segments_router  # noqa: E402
from src.routes.settings import router as settings_router  # noqa: E402
from src.routes.stock_transfers import router as stock_transfers_router  # noqa: E402
from src.routes.storefront import router as storefront_router  # noqa: E402
from src.routes.suppliers import router as suppliers_router  # noqa: E402
from src.routes.tenants import router as tenants_router  # noqa: E402
from src.routes.webhooks import router as webhooks_router  # noqa: E402

app.include_router(public_router, prefix="/api/v1/public")
app.include_router(storefront_router, prefix="/api/v1/storefront")
app.include_router(exchange_rates_router)
app.include_router(analytics_router, prefix="/api/v1/analytics")
app.include_router(ai_router, prefix="/api/v1/ai")
app.include_router(tenants_router, prefix="/api/v1/tenants")
app.include_router(products_router, prefix="/api/v1/products")
app.include_router(orders_router, prefix="/api/v1/orders")
app.include_router(webhooks_router)
app.include_router(auth_router)
app.include_router(admin_auth_router)
app.include_router(admin_fulfillments_router)
app.include_router(admin_shipping_router)
app.include_router(admin_orders_router)
app.include_router(admin_dashboard_router)
app.include_router(admin_webhooks_router)
app.include_router(marketing_templates_router, prefix="/api/v1")
app.include_router(media_router, prefix="/api/v1/media")
app.include_router(navigation_router, prefix="/api/v1")
app.include_router(product_images_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(collections_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(navigation_admin_router, prefix="/api/v1")
app.include_router(inventory_router, prefix="/api/v1")
app.include_router(settings_router, prefix="/api/v1")
app.include_router(segments_router, prefix="/api/v1")
app.include_router(suppliers_router, prefix="/api/v1")
app.include_router(purchase_orders_router, prefix="/api/v1")
app.include_router(promotions_router, prefix="/api/v1")
app.include_router(reviews_router, prefix="/api/v1")
app.include_router(stock_transfers_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
