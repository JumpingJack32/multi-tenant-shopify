import importlib
import os

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine as sa_create_async_engine
from sqlalchemy.pool import NullPool

from src.config import settings

if os.environ.get("APP_ENV") == "test":
    async_engine: AsyncEngine = sa_create_async_engine(
        settings.database_url,
        echo=settings.debug,
        poolclass=NullPool,
    )
else:
    async_engine: AsyncEngine = sa_create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_size=20,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=1800,
    )


async def init_db() -> None:
    """Initialize database tables on startup."""
    from src.orm.base import BaseModel
    # Import all models to register them with SQLAlchemy Base
    importlib.import_module('src.orm.models')
    # from src.orm.models import *  # noqa: F401,F403 - import all models ❌ This causes the error
    # ... rest of the code

    async with async_engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
