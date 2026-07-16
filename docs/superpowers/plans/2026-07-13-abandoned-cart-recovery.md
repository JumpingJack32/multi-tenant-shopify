# Abandoned Cart Recovery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a reminder email when a consumer adds items to their cart but doesn't complete checkout within 2 hours.

**Architecture:** Cart model gains `email`, `status`, `last_reminded_at`, `unsubscribed` fields. Checkout switches from hard-delete to `status=completed`. An `asyncio.create_task()` background worker polls for abandoned carts every 15 minutes using `SELECT FOR UPDATE SKIP LOCKED`, stamps `last_reminded_at`, commits, then sends emails via Resend (phase 2) or logging (phase 1). A public unsubscribe endpoint with HMAC token provides opt-out.

**Tech Stack:** FastAPI, SQLModel/SQLAlchemy, Alembic, stdlib `hmac`, Resend (phase 2)

## Global Constraints

- Cart email captured at checkout via `CheckoutRequest.customer_email`
- Checkout changes from `db.delete(cart)` to `cart.status = CartStatus.COMPLETED`
- Background worker uses `asyncio.create_task()` (same pattern as `_exchange_rate_refresh_worker`)
- `SELECT FOR UPDATE SKIP LOCKED` for race condition prevention
- `last_reminded_at` is committed _before_ network I/O (never hold DB tx across HTTP calls)
- 2h abandonment window, 15min poll interval, 24h retry cooldown
- Unsubscribe uses HMAC-signed token verified against `settings.jwt_secret`
- Frontend clears `cart_{tenantSlug}` cookie + localStorage on checkout success
- Prices are integer cents everywhere

---

### Task 1: Cart Model Evolution — Add CartStatus, Email, and Reminder Fields

**Files:**

- Modify: `services/backend-api/src/orm/models/cart.py`
- Create: `services/backend-api/alembic/versions/0012_add_abandoned_cart_fields.py`
- Test: `services/backend-api/tests/test_abandoned_cart.py`

**Interfaces:**

- Consumes: `Cart` model (existing fields: id, tenant_id, customer_id, expires_at, items, created_at, updated_at)
- Produces: `CartStatus` enum, Cart model with new fields, `Cart.tenant` relationship

- [ ] **Step 1: Write the failing test — Cart model has new fields**

```python
"""Tests for abandoned cart recovery."""

from datetime import datetime, timezone

import pytest

from src.orm.models.cart import Cart, CartItem, CartStatus


class TestCartModel:
    def test_cart_has_abandoned_cart_fields(self):
        """Cart model includes all abandoned cart tracking fields."""
        import inspect

        fields = {name for name, _ in inspect.getmembers(Cart, lambda m: isinstance(m, type(Cart.__annotations__.get(name, None))) or True)}
        # Just check the field names are present on the class
        assert hasattr(Cart, "email")
        assert hasattr(Cart, "status")
        assert hasattr(Cart, "last_reminded_at")
        assert hasattr(Cart, "unsubscribed")
        assert hasattr(Cart, "completed_at")

    def test_cart_status_enum_values(self):
        assert CartStatus.ACTIVE == "active"
        assert CartStatus.COMPLETED == "completed"
        assert CartStatus.ABANDONED == "abandoned"

    def test_cart_status_default_is_active(self):
        """Default factory for status should be ACTIVE."""
        field_info = Cart.model_fields.get("status")
        assert field_info is not None
        # default_factory or default should produce CartStatus.ACTIVE
        default = field_info.default
        if default is None and field_info.default_factory:
            default = field_info.default_factory()
        assert default == CartStatus.ACTIVE
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestCartModel -v`
Expected: FAIL — missing CartStatus, missing fields

- [ ] **Step 3: Add CartStatus enum and new fields to Cart model**

In `services/backend-api/src/orm/models/cart.py`, add after imports:

```python
import enum
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum
from sqlmodel import Field, Relationship

from src.orm.base import BaseModel

if TYPE_CHECKING:
    from src.orm.models.product import Variant
    from src.orm.models.tenant import Tenant


class CartStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
```

Replace the `Cart` class:

```python
class Cart(BaseModel, table=True):
    __tablename__ = "carts"

    customer_id: Optional[UUID] = Field(default=None, foreign_key="customers.id", ondelete="SET NULL")
    expires_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    email: Optional[str] = Field(default=None, max_length=320)
    status: CartStatus = Field(default=CartStatus.ACTIVE, sa_column=Column(SAEnum(CartStatus)))
    last_reminded_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))
    unsubscribed: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    completed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))

    items: list["CartItem"] = Relationship(back_populates="cart", cascade_delete=True)
```

- [ ] **Step 4: Write the Alembic migration**

Create `services/backend-api/alembic/versions/0012_add_abandoned_cart_fields.py`:

```python
"""add abandoned cart tracking fields to carts

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("carts", sa.Column("email", sa.String(320), nullable=True))
    op.add_column(
        "carts",
        sa.Column(
            "status",
            sa.Enum("ACTIVE", "COMPLETED", "ABANDONED", name="cartstatus"),
            nullable=False,
            server_default="ACTIVE",
        ),
    )
    op.add_column(
        "carts",
        sa.Column("last_reminded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "carts",
        sa.Column("unsubscribed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "carts",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_carts_abandoned_worker",
        "carts",
        ["status", "unsubscribed", "email", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_carts_abandoned_worker", table_name="carts")
    op.drop_column("carts", "completed_at")
    op.drop_column("carts", "unsubscribed")
    op.drop_column("carts", "last_reminded_at")
    op.drop_column("carts", "status")
    op.drop_column("carts", "email")
    op.execute("DROP TYPE IF EXISTS cartstatus")
```

- [ ] **Step 5: Run migration**

Run: `cd services/backend-api && doppler run -- uv run alembic upgrade head`
Expected: `INFO  [alembic.runtime.migration] Running upgrade 0011 -> 0012`

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestCartModel -v`
Expected: PASS (2 passed)

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/orm/models/cart.py services/backend-api/alembic/versions/0012_add_abandoned_cart_fields.py
git commit -m "feat: add abandoned cart tracking fields to Cart model + migration"
```

---

### Task 2: Update Checkout — Capture Email, Change to Soft-Delete

**Files:**

- Modify: `services/backend-api/src/orm/schemas/cart.py`
- Modify: `services/backend-api/src/routes/storefront.py`

**Interfaces:**

- Consumes: `CartStatus` enum from Task 1, `Cart.email` field
- Produces: `CheckoutRequest.customer_email` field, checkout sets `cart.status=COMPLETED` instead of `db.delete(cart)`

- [ ] **Step 1: Add `customer_email` to CheckoutRequest**

In `services/backend-api/src/orm/schemas/cart.py`, modify `CheckoutRequest`:

```python
class CheckoutRequest(BaseModel):
    currency: str = "USD"
    customer_email: str | None = None
    shipping_address: dict = Field(default_factory=dict)
    billing_address: dict = Field(default_factory=dict)
    notes: str | None = None
```

- [ ] **Step 2: Update checkout handler — store email, soft-delete, add tenant relationship**

In `services/backend-api/src/routes/storefront.py`, make two changes:

Line 13 — update import to include `CartStatus`:

```python
from src.orm.models.cart import Cart, CartItem, CartStatus
```

Lines 497-498 — replace hard-delete with status update:

```python
    # Mark cart as completed instead of deleting
    cart.email = body.customer_email
    cart.status = CartStatus.COMPLETED
    cart.completed_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(order, ["items"])
```

Add import at top of file:

```python
from datetime import datetime, timezone
```

- [ ] **Step 3: Run lint**

Run: `cd services/backend-api && uvx ruff check src/routes/storefront.py src/orm/schemas/cart.py`
Expected: All checks passed

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/orm/schemas/cart.py services/backend-api/src/routes/storefront.py
git commit -m "feat: capture customer_email at checkout, soft-delete cart (status=completed)"
```

---

### Task 3: EmailService Interface + LogEmailService (Mock Implementation)

**Files:**

- Create: `services/backend-api/src/services/email_service.py`
- Test: `services/backend-api/tests/test_abandoned_cart.py`

**Interfaces:**

- Produces: `EmailService` abstract base class, `LogEmailService` implementation, `create_email_service()` factory

- [ ] **Step 1: Write the failing test**

Add to `services/backend-api/tests/test_abandoned_cart.py`:

```python
class TestEmailService:
    async def test_log_email_service_sends(self):
        from src.services.email_service import LogEmailService, create_email_service

        svc = LogEmailService()
        result = await svc.send_abandoned_cart(
            to_email="test@example.com",
            cart={"id": "abc", "items": [{"product_name": "Widget", "quantity": 1, "unit_price": 1000}]},
            recovery_url="https://example.com/cart?recover=abc",
            tenant_name="Test Store",
            unsubscribe_token="test-token",
        )
        assert result is True

    async def test_create_email_service_returns_log(self):
        from src.services.email_service import LogEmailService, create_email_service

        svc = create_email_service()
        assert isinstance(svc, LogEmailService)
```

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestEmailService -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 2: Create EmailService + LogEmailService**

Create `services/backend-api/src/services/email_service.py`:

```python
"""Email notification service for abandoned cart recovery."""

import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class EmailService(ABC):
    """Abstract email service interface."""

    @abstractmethod
    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,
        recovery_url: str,
        tenant_name: str,
        unsubscribe_token: str,
    ) -> bool:
        """Send abandoned cart reminder email. Returns True on success."""
        ...


class LogEmailService(EmailService):
    """Mock email service that logs instead of sending."""

    async def send_abandoned_cart(
        self,
        to_email: str,
        cart: dict,
        recovery_url: str,
        tenant_name: str,
        unsubscribe_token: str,
    ) -> bool:
        item_count = len(cart.get("items", []))
        logger.info(
            "Abandoned cart email to %s for '%s': %d items, recover at %s (unsub: %s)",
            to_email,
            tenant_name,
            item_count,
            recovery_url,
            unsubscribe_token,
        )
        return True


def create_email_service() -> EmailService:
    """Factory — returns LogEmailService until Resend is configured."""
    return LogEmailService()
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestEmailService -v`
Expected: PASS (2 passed)

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/services/email_service.py
git commit -m "feat: add EmailService interface + LogEmailService mock implementation"
```

---

### Task 4: AbandonedCartService — Query + Send Logic

**Files:**

- Create: `services/backend-api/src/services/abandoned_cart.py`
- Test: `services/backend-api/tests/test_abandoned_cart.py`

**Interfaces:**

- Consumes: `EmailService`, `Cart` model (with new fields), `CartStatus` enum, `Cart.tenant` relationship
- Produces: `AbandonedCartService(db, email_service).process_abandoned_carts() -> int`
- Produces: `sign_unsubscribe_token(cart_id: UUID, email: str, secret: str) -> str`
- Produces: `verify_unsubscribe_token(token: str, secret: str) -> dict`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_abandoned_cart.py`:

```python
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlmodel import select

from src.orm.models.cart import Cart, CartStatus
from src.services.abandoned_cart import (
    AbandonedCartService,
    build_recovery_url,
    sign_unsubscribe_token,
    verify_unsubscribe_token,
)
from src.services.email_service import LogEmailService


class TestTokenUtils:
    def test_sign_and_verify_token(self):
        cart_id = uuid.uuid4()
        email = "test@example.com"
        secret = "test-secret"

        token = sign_unsubscribe_token(cart_id, email, secret)
        payload = verify_unsubscribe_token(token, secret)

        assert str(payload["cart_id"]) == str(cart_id)
        assert payload["email"] == email

    def test_verify_wrong_secret_fails(self):
        cart_id = uuid.uuid4()
        token = sign_unsubscribe_token(cart_id, "test@example.com", "secret1")
        with pytest.raises(ValueError, match="Invalid token"):
            verify_unsubscribe_token(token, "wrong-secret")

    def test_verify_tampered_token_fails(self):
        cart_id = uuid.uuid4()
        token = sign_unsubscribe_token(cart_id, "test@example.com", "secret")
        with pytest.raises(ValueError, match="Invalid token"):
            verify_unsubscribe_token(token[:-1] + "X", "secret")

    def test_build_recovery_url(self):
        url = build_recovery_url("my-store", uuid.UUID(int=1))
        assert url == "https://my-store/cart?recover=00000000-0000-0000-0000-000000000001"


class TestAbandonedCartService:
    @pytest.fixture
    def db_session(self):
        """Return a mock AsyncSession."""
        return AsyncMock()

    @pytest.fixture
    def email_service(self):
        return AsyncMock(spec=LogEmailService)

    @pytest.fixture
    def service(self, db_session, email_service):
        return AbandonedCartService(db_session, email_service)

    async def test_process_no_candidates(self, service, db_session):
        """When no carts qualify, no emails are sent."""
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db_session.execute.return_value = result_mock

        count = await service.process_abandoned_carts()

        assert count == 0
        db_session.commit.assert_called_once()

    async def test_process_with_candidates(self, service, db_session, email_service):
        """Carts meeting criteria are processed and email is sent."""
        mock_cart = MagicMock(spec=Cart)
        mock_cart.id = uuid.uuid4()
        mock_cart.email = "buyer@example.com"
        mock_cart.unsubscribed = False
        mock_cart.items = []
        mock_tenant = MagicMock()
        mock_tenant.slug = "my-store"
        mock_tenant.name = "My Store"
        mock_cart.tenant = mock_tenant

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [mock_cart]
        db_session.execute.return_value = result_mock
        email_service.send_abandoned_cart.return_value = True

        count = await service.process_abandoned_carts()

        assert count == 1
        assert mock_cart.last_reminded_at is not None
        db_session.commit.assert_called_once()
        email_service.send_abandoned_cart.assert_awaited_once()
```

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestTokenUtils tests/test_abandoned_cart.py::TestAbandonedCartService -v`
Expected: FAIL — ModuleNotFoundError

- [ ] **Step 2: Create AbandonedCartService**

Create `services/backend-api/src/services/abandoned_cart.py`:

```python
"""Abandoned cart detection and email reminder service."""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import or_
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel.sql.expression import selectinload

from src.config import settings
from src.orm.models.cart import Cart, CartStatus
from src.orm.models.tenant import Tenant
from src.services.email_service import EmailService

ABANDONMENT_HOURS = 2
POLL_LIMIT = 50
RETRY_COOLDOWN_HOURS = 24

logger = logging.getLogger(__name__)


def sign_unsubscribe_token(cart_id: UUID, email: str, secret: str) -> str:
    """Create HMAC-SHA256 token for unsubscribe link."""
    payload = json.dumps({"cart_id": str(cart_id), "email": email}, sort_keys=True)
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_unsubscribe_token(token: str, secret: str) -> dict:
    """Verify HMAC-SHA256 token and return payload dict."""
    try:
        payload_str, sig = token.rsplit(":", 1)
        expected = hmac.new(secret.encode(), payload_str.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise ValueError("Invalid token")
        return json.loads(payload_str)
    except (ValueError, json.JSONDecodeError) as e:
        raise ValueError("Invalid token") from e


def build_recovery_url(tenant_slug: str, cart_id: UUID) -> str:
    """Build recovery URL linking back to the storefront cart.
    NOTE: The host is set to tenant_slug as a local placeholder.
    In production this should use the tenant's actual domain from settings."""
    return f"https://{tenant_slug}/cart?recover={cart_id}"


class AbandonedCartService:
    """Finds abandoned carts and sends reminder emails."""

    def __init__(self, db: AsyncSession, email_service: EmailService):
        self.db = db
        self.email_service = email_service

    async def process_abandoned_carts(self) -> int:
        """Find abandoned carts, stamp + commit, then send emails. Returns count sent."""
        cutoff = datetime.now(timezone.utc) - timedelta(hours=ABANDONMENT_HOURS)
        cooldown = datetime.now(timezone.utc) - timedelta(hours=RETRY_COOLDOWN_HOURS)

        stmt = (
            select(Cart)
            .options(selectinload(Cart.items))
            .where(
                Cart.status == CartStatus.ACTIVE,
                Cart.email.isnot(None),
                Cart.unsubscribed == False,
                Cart.updated_at < cutoff,
                or_(
                    Cart.last_reminded_at.is_(None),
                    Cart.last_reminded_at < cooldown,
                ),
            )
            .order_by(Cart.updated_at.asc())
            .limit(POLL_LIMIT)
            .with_for_update(skip_locked=True)
        )

        result = await self.db.execute(stmt)
        carts = result.scalars().all()

        if not carts:
            await self.db.commit()
            return 0

        # Batch-fetch tenants to avoid N+1
        tenant_ids = {c.tenant_id for c in carts if c.tenant_id}
        tenant_stmt = select(Tenant).where(Tenant.tenant_id.in_(tenant_ids))
        tenant_result = await self.db.execute(tenant_stmt)
        tenant_map = {t.tenant_id: t for t in tenant_result.scalars().all()}

        # Extract payload and stamp before commit
        payloads = []
        for cart in carts:
            cart.last_reminded_at = datetime.now(timezone.utc)
            tenant = tenant_map.get(cart.tenant_id) if cart.tenant_id else None
            payloads.append({
                "id": cart.id,
                "email": cart.email,
                "items": [
                    {
                        "id": str(i.id) if hasattr(i, "id") else None,
                        "product_name": i.variant.product.name if i.variant and i.variant.product else "Product",
                        "quantity": i.quantity,
                        "unit_price": i.variant.price if i.variant else 0,
                    }
                    for i in cart.items
                ],
                "tenant_slug": tenant.slug if tenant else "store",
                "tenant_name": tenant.name if tenant else "Store",
            })

        await self.db.commit()

        # Network I/O outside transaction
        for payload in payloads:
            try:
                recovery_url = build_recovery_url(payload["tenant_slug"], payload["id"])
                unsub_token = sign_unsubscribe_token(
                    payload["id"], payload["email"], settings.jwt_secret
                )
                await self.email_service.send_abandoned_cart(
                    to_email=payload["email"],
                    cart=payload,
                    recovery_url=recovery_url,
                    tenant_name=payload["tenant_name"],
                    unsubscribe_token=unsub_token,
                )
            except Exception:
                logger.exception(
                    "Failed to send abandoned cart email for cart %s",
                    payload["id"],
                )

        return len(payloads)
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestTokenUtils tests/test_abandoned_cart.py::TestAbandonedCartService -v`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `cd services/backend-api && uvx ruff check src/services/abandoned_cart.py`
Expected: All checks passed

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/services/abandoned_cart.py
git commit -m "feat: add AbandonedCartService with SELECT FOR UPDATE pattern"
```

---

### Task 5: Background Worker + Unsubscribe Endpoint

**Files:**

- Modify: `services/backend-api/src/main.py`
- Modify: `services/backend-api/src/routes/public.py`

**Interfaces:**

- Consumes: `AbandonedCartService`, `Cart`
- Produces: `_abandoned_cart_worker` background task, `POST /api/v1/public/carts/unsubscribe/{token}` endpoint

- [ ] **Step 1: Write integration tests**

Add to `tests/test_abandoned_cart.py`:

```python
class TestUnsubscribeEndpoint:
    @pytest.fixture
    def test_app(self, db_session):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from src.dependencies import get_db
        from src.routes.public import router

        app = FastAPI()
        # Override get_db with test session so no live DB connection is needed
        app.dependency_overrides[get_db] = lambda: db_session
        app.include_router(router, prefix="/api/v1/public")
        return TestClient(app)

    def test_unsubscribe_invalid_token(self, test_app):
        response = test_app.post("/api/v1/public/carts/unsubscribe/invalid-token")
        assert response.status_code == 400
        assert "Invalid" in response.json()["detail"]

    def test_unsubscribe_valid_token(self, test_app, db_session):
        from src.orm.models.cart import Cart

        # Create a real cart in the test DB so the endpoint finds it
        cart = Cart(tenant_id=uuid.uuid4(), email="test@example.com")
        db_session.add(cart)
        db_session.commit()

        token = sign_unsubscribe_token(cart.id, "test@example.com", settings.jwt_secret)
        response = test_app.post(f"/api/v1/public/carts/unsubscribe/{token}")
        assert response.status_code == 200

        # Verify DB was updated
        db_session.refresh(cart)
        assert cart.unsubscribed is True
```

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestUnsubscribeEndpoint -v`
Expected: Fail — endpoint not found (2 failures)

- [ ] **Step 2: Add background worker to main.py**

In `services/backend-api/src/main.py`, add global variable near line 17:

```python
_abandoned_cart_task: asyncio.Task | None = None
```

Add worker function after `_exchange_rate_refresh_worker` (after line 32):

```python
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
```

In the lifespan, start the task alongside the exchange rate worker (after line 64):

```python
    # Start abandoned cart background worker
    _abandoned_cart_task = asyncio.create_task(_abandoned_cart_worker())
```

In the cleanup section (after line 74), add:

```python
    if _abandoned_cart_task:
        _abandoned_cart_task.cancel()
        try:
            await _abandoned_cart_task
        except asyncio.CancelledError:
            pass
```

- [ ] **Step 3: Add unsubscribe endpoint to public router**

In `services/backend-api/src/routes/public.py`, add import at top:

```python
from src.config import settings
from src.orm.models.cart import Cart
from src.services.abandoned_cart import verify_unsubscribe_token
```

Add endpoint at end of file:

```python
@router.post("/carts/unsubscribe/{token}")
async def unsubscribe_cart_recovery(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Unsubscribe from abandoned cart emails via signed token."""
    try:
        payload = verify_unsubscribe_token(token, settings.jwt_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid unsubscribe token")

    cart = await db.get(Cart, payload["cart_id"])
    if cart and cart.email == payload["email"]:
        cart.unsubscribed = True
        await db.commit()

    return {"ok": True}
```

- [ ] **Step 4: Run integration tests**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py::TestUnsubscribeEndpoint -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Run lint**

Run: `cd services/backend-api && uvx ruff check src/main.py src/routes/public.py`
Expected: All checks passed

- [ ] **Step 6: Commit**

```bash
git add services/backend-api/src/main.py services/backend-api/src/routes/public.py
git commit -m "feat: wire abandoned cart background worker + unsubscribe endpoint"
```

---

### Task 6: Email Templates (HTML + Plaintext)

**Files:**

- Create: `services/backend-api/src/templates/email/abandoned_cart.html`
- Create: `services/backend-api/src/templates/email/abandoned_cart.txt`

**Interfaces:**

- Consumes: Jinja2 template variables: `{{ tenant_name }}`, `{{ items }}`, `{{ total }}`, `{{ recovery_url }}`, `{{ unsubscribe_url }}`
- Produces: Renderable email templates for the ResendEmailService (phase 2)

- [ ] **Step 1: Create HTML template**

Create `services/backend-api/src/templates/email/abandoned_cart.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>You left items in your cart</title>
  </head>
  <body
    style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;"
  >
    <h1 style="font-size: 20px; font-weight: 400; letter-spacing: -0.01em;">
      {{ tenant_name }}
    </h1>
    <p style="color: #666; font-size: 14px;">
      You left items in your cart — they're still waiting for you.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
      {% for item in items %}
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 0;">
          <p style="margin: 0; font-size: 14px;">{{ item.product_name }}</p>
          <p style="margin: 4px 0 0; color: #666; font-size: 12px;">
            Qty: {{ item.quantity }}
          </p>
        </td>
        <td style="padding: 12px 0; text-align: right; font-size: 14px;">
          £{{ "%.2f"|format(item.unit_price / 100) }}
        </td>
      </tr>
      {% endfor %}
    </table>

    <a
      href="{{ recovery_url }}"
      style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-size: 14px;"
      >Complete Your Order</a
    >

    <p style="margin-top: 32px; font-size: 12px; color: #999;">
      <a href="{{ unsubscribe_url }}" style="color: #999;"
        >Unsubscribe from cart reminders</a
      >
    </p>
  </body>
</html>
```

- [ ] **Step 2: Create plaintext template**

Create `services/backend-api/src/templates/email/abandoned_cart.txt`:

```
{{ tenant_name }}

You left items in your cart — they're still waiting for you.

{% for item in items %}{{ item.product_name }} × {{ item.quantity }} — £{{ "%.2f"|format(item.unit_price / 100) }}
{% endfor %}

Complete your order: {{ recovery_url }}

To unsubscribe from cart reminders: {{ unsubscribe_url }}
```

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/src/templates/email/abandoned_cart.html services/backend-api/src/templates/email/abandoned_cart.txt
git commit -m "feat: add abandoned cart email templates (HTML + plaintext)"
```

---

### Task 7: Frontend — Email Capture + Cart Cleanup on Checkout Success

**Files:**

- Modify: Frontend checkout flow (cart drawer / checkout form)

**Interfaces:**

- Consumes: `CheckoutRequest.customer_email` from Task 2
- Produces: Email input in checkout flow, cart cookie cleared on success

- [ ] **Step 1: Add email input to checkout flow**

In the checkout form component (likely `apps/storefront/src/components/cart/cart-drawer.tsx` or a checkout page), add an email input before the submit button:

```tsx
const [email, setEmail] = useState("");

// In the form, before the Place Order button:
<div>
  <label htmlFor="checkout-email" className="text-xs text-muted-foreground">
    Email (for order updates)
  </label>
  <input
    id="checkout-email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="you@example.com"
    required
    className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-transparent mt-1"
  />
</div>;
```

Pass `customer_email: email` to the `checkoutCart` call.

- [ ] **Step 2: Clear cart cookie on checkout success**

In the checkout mutation's `onSuccess` callback, add:

```tsx
import { useParams } from "next/navigation";

// Inside the checkout mutation:
const params = useParams();
const tenantSlug = (params?.tenant ?? "") as string;

const checkoutMutation = useMutation({
  mutationFn: () => checkoutCart(tenantSlug, cartId, checkoutData),
  onSuccess: (order) => {
    // Clear cart cookie and local state
    document.cookie = `cart_${tenantSlug}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    localStorage.removeItem(`cart_${tenantSlug}`);
    // Reset zustand store
    useCartStore.getState().clearCart();
    // Navigate to order confirmation
    router.push(`/${tenantSlug}/order-confirmation/${order.id}`);
  },
});
```

- [ ] **Step 3: Handle stale completed cart from cookie**

In the storefront's cart initialization logic (where `GET /carts/{id}` is called on page load), add an explicit check for the cart's status. If the cart was already completed, clear the local reference and trigger a fresh cart lifecycle:

```typescript
// Inside your cart fetching logic (e.g., query effect in the layout or cart hook)
const { data: cart } = useQuery(["cart", cartId], () =>
  fetchCart(tenantSlug, cartId),
);

useEffect(() => {
  if (cart && cart.status === "completed") {
    // Cookie revived a stale completed cart — clear it
    document.cookie = `cart_${tenantSlug}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    localStorage.removeItem(`cart_${tenantSlug}`);
    useCartStore.getState().clearCart();
    // Trigger fresh cart generation
    useCartStore.getState().initializeFreshCart(tenantSlug);
  }
}, [cart, tenantSlug]);
```

Add `status` to `CartResponse` schema so the frontend can read it:

In `services/backend-api/src/orm/schemas/cart.py`, add to `CartResponse`:

```python
status: str = "active"
```

- [ ] **Step 4: Run frontend typecheck**

Run: `pnpm --filter @repo/storefront typecheck 2>&1 | tail -10`
Expected: All checks passed

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/components/ apps/storefront/src/hooks/
git commit -m "feat: add email capture to checkout, clear cart cookie on success"
```

---

### Task 8: Full Test Suite

**Files:**

- Modify: `services/backend-api/tests/test_abandoned_cart.py`

**Interfaces:**

- Tests all components end-to-end

- [ ] **Step 1: Add integration test for full checkout flow**

Add to `tests/test_abandoned_cart.py`:

```python
class TestCheckoutIntegration:
    """Test checkout flow with customer_email capture and status transition."""

    async def test_checkout_stores_email_and_soft_deletes(self, client, db_session):
        """After checkout, cart has email set and status=completed (not deleted)."""
        from src.orm.models.cart import Cart
        from src.orm.models.product import Variant

        # Create a minimal test tenant + variant + cart
        tenant = Tenant(slug="test-acr", name="ACR Test", status="ACTIVE", settings={"currency": "GBP"})
        db_session.add(tenant)
        await db_session.flush()

        product = Product(tenant_id=tenant.tenant_id, name="Test Product", slug="test-product", status="active")
        db_session.add(product)
        await db_session.flush()

        variant = Variant(tenant_id=tenant.tenant_id, product_id=product.id, sku="ACR-TEST", price=1995, inventory_quantity=10)
        db_session.add(variant)
        await db_session.flush()

        cart = Cart(tenant_id=tenant.tenant_id)
        db_session.add(cart)
        await db_session.flush()

        from src.orm.models.cart import CartItem
        item = CartItem(cart_id=cart.id, variant_id=variant.id, quantity=1, tenant_id=tenant.tenant_id)
        db_session.add(item)
        await db_session.commit()

        cart_id = cart.id

        # Execute checkout via the actual API route
        from httpx import AsyncClient
        from src.main import app

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                f"/api/v1/storefront/{tenant.slug}/carts/{cart_id}/checkout",
                json={"customer_email": "buyer@test.com"},
            )
        assert response.status_code == 201

        # Fetch cart — should still exist, but with updated status
        cart = await db_session.get(Cart, cart_id)
        assert cart is not None
        assert cart.email == "buyer@test.com"
        assert cart.status == CartStatus.COMPLETED
        assert cart.completed_at is not None
```

- [ ] **Step 2: Run all abandoned cart tests**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/test_abandoned_cart.py -v`
Expected: All tests PASS

- [ ] **Step 3: Run full backend test suite**

Run: `cd services/backend-api && doppler run -- uv run pytest tests/ -x -q 2>&1 | tail -10`
Expected: No regressions (same pass/fail as before)

- [ ] **Step 4: Run lint**

Run: `cd services/backend-api && uvx ruff check src/ tests/`
Expected: All checks passed

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/tests/test_abandoned_cart.py
git commit -m "test: add abandoned cart recovery tests"
```
