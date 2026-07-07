from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.config import settings
from src.database import init_db
from src.core.cache import redis_client
from src.core.tenant_isolation import reset_tenant_context, setup_tenant_isolation


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup and cleanup on shutdown."""
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

    yield

    # Cleanup
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


@app.middleware("http")
async def tenant_isolation_middleware(request: Request, call_next):
    """Reset tenant context for each request."""
    reset_tenant_context()
    response = await call_next(request)
    reset_tenant_context()
    return response

from src.routes.public import router as public_router  # noqa: E402
from src.routes.tenants import router as tenants_router  # noqa: E402
from src.routes.products import router as products_router  # noqa: E402
from src.routes.orders import router as orders_router  # noqa: E402
from src.routes.webhooks import router as webhooks_router  # noqa: E402
from src.routes.auth import router as auth_router  # noqa: E402
from src.routes.admin_auth import router as admin_auth_router  # noqa: E402
from src.routes.categories import router as categories_router  # noqa: E402
from src.routes.customers import router as customers_router  # noqa: E402
from src.routes.collections import router as collections_router  # noqa: E402
from src.routes.media import router as media_router  # noqa: E402
from src.routes.product_images import router as product_images_router  # noqa: E402

app.include_router(public_router, prefix="/api/v1/public")
app.include_router(tenants_router, prefix="/api/v1/tenants")
app.include_router(products_router, prefix="/api/v1/products")
app.include_router(orders_router, prefix="/api/v1/orders")
app.include_router(webhooks_router)
app.include_router(auth_router)
app.include_router(admin_auth_router)
app.include_router(media_router, prefix="/api/v1/media")
app.include_router(product_images_router, prefix="/api/v1")
app.include_router(categories_router, prefix="/api/v1")
app.include_router(collections_router, prefix="/api/v1")
app.include_router(customers_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
