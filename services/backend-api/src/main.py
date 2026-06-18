from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from src.config import Settings

settings = Settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate all required env vars on startup (fail-fast)
    _ = settings.supabase_url
    _ = settings.supabase_key
    _ = settings.clerk_secret_key
    _ = settings.svix_webhook_secret
    yield

app = FastAPI(
    title="Multi-Tenant Shopify API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Tenant-ID"],
)

from src.routes.tenants import router as tenants_router  # noqa: E402
from src.routes.products import router as products_router  # noqa: E402
from src.routes.orders import router as orders_router  # noqa: E402
from src.routes.webhooks import router as webhooks_router  # noqa: E402

app.include_router(tenants_router, prefix="/api/v1/tenants")
app.include_router(products_router, prefix="/api/v1/products")
app.include_router(orders_router, prefix="/api/v1/orders")
app.include_router(webhooks_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
