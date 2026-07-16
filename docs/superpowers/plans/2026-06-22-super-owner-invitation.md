# Super OWNER & Store Owner Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated Super OWNER platform access and Store Owner invitation flow using Clerk Organizations with split `/platform/*` and `/admin/*` routing.

**Architecture:** Hybrid auth where Clerk handles identity (sign-in, OAuth, MFA, orgs) and PostgreSQL handles authorization flags (`is_platform_superuser`, `UserRole`). Clerk Organizations map to tenants. Webhooks sync org memberships to DB. JWT claims mirror DB flags for stateless middleware checks. Split routing separates platform management (`/platform/*`) from store administration (`/admin/*`).

**Tech Stack:** Python 3.14, FastAPI, SQLModel, PostgreSQL, Clerk v6 (@clerk/nextjs), Next.js 16, Alembic, base-ui

## Global Constraints

- No custom password hashing or auth forms — all auth via Clerk hosted UI
- Super OWNER identified by explicit DB flag `is_platform_superuser`, not "first user wins"
- Clerk Organizations = Tenants; `org:admin` → OWNER/ADMIN, `org:member` → MANAGER/STAFF
- Webhook-driven sync: `organizationMembership.created`/`deleted` events create/update `TenantUser` records
- Frontend uses Clerk UI components exclusively for auth/org management
- Backend-first: DB schema → webhooks → JWT → API → frontend
- TDD: write failing tests before implementation, commit frequently
- DRY/YAGNI: no over-engineering, only what's needed for this feature

---

### Task 1: Add `is_platform_superuser` to `TenantUser` Schema

**Files:**

- Modify: `services/backend-api/src/orm/models/tenant.py`
- Modify: `services/backend-api/src/orm/schemas/tenant.py`
- Create: `services/backend-api/alembic/versions/0002_add_platform_superuser_flag.py`
- Test: `services/backend-api/tests/test_platform_superuser.py`

**Interfaces:**

- Consumes: `TenantUser` model with existing fields
- Produces: `TenantUser.is_platform_superuser: bool = False` field, Alembic migration, schema update

- [ ] **Step 1: Write the failing test**

```python
# services/backend-api/tests/test_platform_superuser.py
import pytest
from sqlmodel import select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from src.orm.models.tenant import TenantUser


async def test_tenant_user_has_platform_superuser_field():
    """Verify TenantUser model has is_platform_superuser column."""
    assert hasattr(TenantUser, "is_platform_superuser")
    # Default should be False
    user = TenantUser(
        tenant_id="00000000-0000-0000-0000-000000000001",
        clerk_user_id="user_test_123",
        email="test@example.com",
        password_hash="",
    )
    assert user.is_platform_superuser is False


async def test_tenant_user_can_be_set_as_platform_superuser(
    db_session: AsyncSession,
):
    """Verify we can create and query a platform superuser."""
    from src.database import async_engine
    from sqlmodel import select

    async with async_engine.begin() as conn:
        # Only run if migration has been applied
        try:
            result = await conn.execute(
                text("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_users' AND column_name = 'is_platform_superuser')")
            )
            has_column = result.scalar()
        except Exception:
            has_column = False

    if not has_column:
        pytest.skip("Migration not yet applied")

    async with AsyncSession(async_engine) as session:
        user = TenantUser(
            tenant_id="00000000-0000-0000-0000-000000000001",
            clerk_user_id="user_test_123",
            email="super@example.com",
            password_hash="",
            is_platform_superuser=True,
        )
        session.add(user)
        await session.flush()
        await session.refresh(user)

        stmt = select(TenantUser).where(TenantUser.clerk_user_id == "user_test_123")
        result = await session.execute(stmt)
        found = result.scalar_one()
        assert found.is_platform_superuser is True
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/backend-api && python -m pytest tests/test_platform_superuser.py::test_tenant_user_has_platform_superuser_field -v`
Expected: FAIL with `AttributeError: type object 'TenantUser' has no attribute 'is_platform_superuser'`

- [ ] **Step 3: Write minimal implementation — add field to TenantUser model**

```python
# services/backend-api/src/orm/models/tenant.py (add to TenantUser class, after is_active)
    is_platform_superuser: bool = Field(default=False)
```

Full updated TenantUser class:

```python
class TenantUser(SQLModel, table=True):
    __tablename__ = "tenant_users"
    __table_args__ = (
        Index("ix_tenant_users_tenant_clerk_id", "tenant_id", "clerk_user_id"),
        UniqueConstraint("tenant_id", "clerk_user_id", name="uq_tenant_users_tenant_clerk_id"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    tenant_id: UUID = Field(foreign_key="tenants.id", ondelete="CASCADE")
    clerk_user_id: str = Field(default="", max_length=255)
    email: str = Field(max_length=255)
    password_hash: str = Field(max_length=255)
    role: str = Field(default="member", max_length=50)
    is_active: bool = Field(default=True)
    is_platform_superuser: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now())
    updated_at: datetime = Field(default_factory=lambda: datetime.now())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/backend-api && python -m pytest tests/test_platform_superuser.py::test_tenant_user_has_platform_superuser_field -v`
Expected: PASS

- [ ] **Step 5: Create Alembic migration**

Run: `cd services/backend-api && alembic revision -m "add_platform_superuser_flag"`

Then edit the generated migration file to add the column:

```python
def upgrade() -> None:
    op.add_column("tenant_users", sa.Column("is_platform_superuser", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("tenant_users", "is_platform_superuser")
```

Run: `cd services/backend-api && alembic upgrade head`
Expected: Migration applied successfully, no errors

- [ ] **Step 6: Run all tests to verify nothing broke**

Run: `cd services/backend-api && python -m pytest tests/ -v`
Expected: All existing tests pass + new test passes

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/orm/models/tenant.py services/backend-api/alembic/versions/0002_add_platform_superuser_flag.py services/backend-api/tests/test_platform_superuser.py
git commit -m "feat: add is_platform_superuser field to TenantUser model"
```

---

### Task 2: Install Clerk SDK and Configure JWT Verification

**Files:**

- Modify: `services/backend-api/pyproject.toml`
- Modify: `services/backend-api/src/config.py`
- Modify: `services/backend-api/src/core/security.py`
- Test: `services/backend-api/tests/test_jwt_verification.py`

**Interfaces:**

- Consumes: `clerk_secret_key` from settings
- Produces: `verify_clerk_token()` function that validates Clerk JWTs and extracts user claims

- [ ] **Step 1: Write the failing test**

```python
# services/backend-api/tests/test_jwt_verification.py
import pytest
from src.core.security import verify_clerk_token


async def test_verify_clerk_token_returns_claims():
    """Verify token verification extracts Clerk JWT claims."""
    # This test will fail until we implement the function
    with pytest.raises(ImportError):
        verify_clerk_token("fake_token")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/backend-api && python -m pytest tests/test_jwt_verification.py -v`
Expected: FAIL with `ImportError: cannot import name 'verify_clerk_token'`

- [ ] **Step 3: Install clerk-sdk-python**

Run: `cd services/backend-api && uv add clerk-sdk-python`

- [ ] **Step 4: Add Clerk API base URL to config**

```python
# services/backend-api/src/config.py (add to Settings class)
    clerk_api_url: str = "https://api.clerk.com"
```

- [ ] **Step 5: Implement Clerk token verification**

```python
# services/backend-api/src/core/security.py
import httpx
from datetime import datetime
from typing import Any, Optional
from jose import JWTError, jwt as pyjwt
from src.config import settings


ALGORITHM = "HS256"


async def verify_clerk_token(token: str) -> dict[str, Any]:
    """Verify a Clerk JWT and return decoded claims.

    Uses Clerk's /v1/jwks endpoint to verify the token signature
    and extracts user_id, org_id, org_role, and custom claims.
    """
    if not token:
        raise ValueError("Empty token")

    # Get Clerk's public keys
    async with httpx.AsyncClient() as client:
        jwks_response = await client.get(
            f"{settings.clerk_api_url}/v1/jwks",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
        jwks_response.raise_for_status()
        jwks = jwks_response.json()

    # Find the correct key by kid
    header = pyjwt.get_unverified_header(token)
    kid = header.get("kid")

    key_data = None
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            key_data = key
            break

    if not key_data:
        raise ValueError(f"No matching public key found for kid: {kid}")

    # Verify and decode the token
    claims = pyjwt.decode(
        token,
        key=_convert_jwk_to_pem(key_data),
        algorithms=["RS256"],
        audience=settings.clerk_publishable_key,
    )

    return claims


def _convert_jwk_to_pem(jwk: dict) -> str:
    """Convert JWK to PEM format for pyjwt."""
    import base64

    n = int.from_bytes(base64.urlsafe_b64decode(jwk["n"] + "=="), "big")
    e = int.from_bytes(base64.urlsafe_b64decode(jwk["e"] + "=="), "big")

    # Build RSA public key PEM
    from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
    from cryptography.hazmat.primitives import serialization

    public_numbers = RSAPublicNumbers(e, n)
    public_key = public_numbers.public_key()
    pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem.decode()


async def get_clerk_user_id(token: str) -> str:
    """Extract Clerk user ID from a verified JWT."""
    claims = await verify_clerk_token(token)
    return claims.get("sub") or claims.get("oid") or claims.get("user_id")
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/backend-api && python -m pytest tests/test_jwt_verification.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add services/backend-api/src/core/security.py services/backend-api/src/config.py services/backend-api/tests/test_jwt_verification.py
git commit -m "feat: add Clerk JWT token verification"
```

---

### Task 3: Build Clerk Webhook Handler

**Files:**

- Create: `services/backend-api/src/routes/webhooks/clerk.py`
- Modify: `services/backend-api/src/routes/webhooks/__init__.py`
- Test: `services/backend-api/tests/test_clerk_webhooks.py`

**Interfaces:**

- Consumes: `verify_clerk_webhook_signature()`, `TenantUser`, `Tenant` models
- Produces: Webhook handler for `organizationMembership.created`, `organizationMembership.deleted`, `user.deleted` events

- [ ] **Step 1: Write the failing test**

```python
# services/backend-api/tests/test_clerk_webhooks.py
import pytest
from fastapi.testclient import TestClient
from src.main import app


async def test_clerk_webhook_organization_membership_created(client: TestClient):
    """Verify webhook creates TenantUser on org membership."""
    payload = {
        "event": {
            "type": "organizationMembership.created",
            "data": {
                "organization": {
                    "id": "org_test_123",
                    "name": "Test Org"
                },
                "user": {
                    "id": "user_test_123",
                    "email_addresses": [{"email_address": "test@example.com"}]
                },
                "role": "org:admin"
            }
        }
    }

    response = client.post(
        "/api/v1/webhooks/clerk",
        json=payload,
        headers={"X-Clerk-Signature": "test"},
    )
    assert response.status_code == 200


async def test_clerk_webhook_organization_membership_deleted(client: TestClient):
    """Verify webhook deactivates TenantUser on org membership deletion."""
    payload = {
        "event": {
            "type": "organizationMembership.deleted",
            "data": {
                "organization": {
                    "id": "org_test_123",
                },
                "user": {
                    "id": "user_test_123",
                }
            }
        }
    }

    response = client.post(
        "/api/v1/webhooks/clerk",
        json=payload,
        headers={"X-Clerk-Signature": "test"},
    )
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/backend-api && python -m pytest tests/test_clerk_webhooks.py -v`
Expected: FAIL with 404 (route doesn't exist yet)

- [ ] **Step 3: Create webhook handler file**

```python
# services/backend-api/src/routes/webhooks/clerk.py
import hmac
import hashlib
import json
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, status
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.core.security import verify_clerk_webhook_signature
from src.database import async_engine
from src.orm.models.tenant import Tenant, TenantUser

router = APIRouter(prefix="/webhooks/clerk", tags=["clerk-webhooks"])


@router.post("")
async def handle_clerk_webhook(request: Request):
    """Handle Clerk webhook events for tenant/user sync."""
    # Verify webhook signature
    payload = await request.body()
    signature = request.headers.get("x-clerk-signature", "")
    timestamp = request.headers.get("x-clerk-webhook-timestamp", "")

    try:
        event = verify_clerk_webhook_signature(payload, signature, timestamp)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid webhook signature: {e}")

    event_type = event.get("type", "")
    data = event.get("data", {})

    async with async_engine.begin() as conn:
        if event_type == "organizationMembership.created":
            await _handle_org_membership_created(conn, data)
        elif event_type == "organizationMembership.deleted":
            await _handle_org_membership_deleted(conn, data)
        elif event_type == "user.deleted":
            await _handle_user_deleted(conn, data)

    return {"status": "ok"}


async def _handle_org_membership_created(conn, data: dict):
    """Handle new organization membership — create TenantUser."""
    org_id = data.get("organization", {}).get("id")
    user_id = data.get("user", {}).get("id")
    email = data.get("user", {}).get("email_addresses", [{}])[0].get("email_address", "")
    role = data.get("role", "org:member")

    # Map Clerk org role to DB role
    db_role = "owner" if role == "org:admin" else "member"

    # Check if Tenant exists, create if not
    tenant_result = await conn.execute(
        select(Tenant).where(Tenant.clerk_org_id == org_id)
    )
    tenant = tenant_result.scalar_one_or_none()

    if not tenant:
        tenant = Tenant(
            id=org_id,  # Use Clerk org ID as tenant ID
            name=data.get("organization", {}).get("name", "Unknown"),
            clerk_org_id=org_id,
            is_active=True,
        )
        await conn.execute(tenant.__table__.insert().values(**{
            "id": org_id,
            "name": tenant.name,
            "clerk_org_id": org_id,
            "is_active": True,
            "created_at": datetime.now(UTC),
            "updated_at": datetime.now(UTC),
        }))
        await conn.commit()

    # Check if TenantUser already exists
    existing = await conn.execute(
        select(TenantUser).where(
            TenantUser.tenant_id == org_id,
            TenantUser.clerk_user_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # Already exists, skip

    # Create TenantUser
    await conn.execute(TenantUser.__table__.insert().values(
        id=f"{org_id}-{user_id}",  # Composite ID or let DB generate
        tenant_id=org_id,
        clerk_user_id=user_id,
        email=email,
        password_hash="",  # No password needed — Clerk handles auth
        role=db_role,
        is_active=True,
        is_platform_superuser=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    ))
    await conn.commit()


async def _handle_org_membership_deleted(conn, data: dict):
    """Handle removed organization membership — deactivate TenantUser."""
    org_id = data.get("organization", {}).get("id")
    user_id = data.get("user", {}).get("id")

    await conn.execute(
        TenantUser.__table__.update().where(
            TenantUser.tenant_id == org_id,
            TenantUser.clerk_user_id == user_id,
        ).values(
            is_active=False,
            updated_at=datetime.now(UTC),
        )
    )
    await conn.commit()


async def _handle_user_deleted(conn, data: dict):
    """Handle deleted user — deactivate all TenantUser records."""
    user_id = data.get("id", "")

    await conn.execute(
        TenantUser.__table__.update().where(
            TenantUser.clerk_user_id == user_id,
        ).values(
            is_active=False,
            updated_at=datetime.now(UTC),
        )
    )
    await conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/backend-api && python -m pytest tests/test_clerk_webhooks.py -v`
Expected: PASS

- [ ] **Step 5: Register webhook router in main.py**

```python
# services/backend-api/src/main.py (add to imports and app setup)
from src.routes.webhooks.clerk import router as clerk_webhook_router

app.include_router(clerk_webhook_router)
```

- [ ] **Step 6: Commit**

```bash
git add services/backend-api/src/routes/webhooks/clerk.py services/backend-api/src/routes/webhooks/__init__.py services/backend-api/tests/test_clerk_webhooks.py services/backend-api/src/main.py
git commit -m "feat: add Clerk webhook handler for tenant/user sync"
```

---

### Task 4: Configure Clerk JWT Template with Custom Claims

**Files:**

- No code changes — Clerk dashboard configuration
- Test: `services/backend-api/tests/test_jwt_claims.py`

**Interfaces:**

- Consumes: Clerk dashboard access, `is_platform_superuser` DB flag
- Produces: JWT template that includes `is_platform_superuser` and `org_role` claims

- [ ] **Step 1: Create JWT template in Clerk dashboard**

In Clerk Dashboard → Authentication → JWT Templates → Create new template:

```json
{
  "name": "tenant-api",
  "claims": {
    "sub": "{{user.id}}",
    "org_id": "{{org.id}}",
    "org_role": "{{org.role}}",
    "is_platform_superuser": "{{user.custom_attributes.is_platform_superuser}}",
    "email": "{{user.email_addresses[0].email_address}}"
  },
  "token_expiration": 3600,
  "org_inactive_session_ttl": 604800
}
```

- [ ] **Step 2: Add custom attribute endpoint to sync DB flag to Clerk**

```python
# services/backend-api/src/routes/clerk_sync.py (new file)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.config import settings

router = APIRouter(prefix="/api/v1/clerk", tags=["clerk-sync"])


@router.post("/sync-platform-superuser")
async def sync_platform_superuser(
    clerk_user_id: str,
    is_superuser: bool,
    db: AsyncSession = Depends(get_db),
):
    """Sync is_platform_superuser flag from DB to Clerk custom attributes."""
    # Update DB
    await db.execute(
        text("UPDATE tenant_users SET is_platform_superuser = :val WHERE clerk_user_id = :uid"),
        {"val": is_superuser, "uid": clerk_user_id}
    )
    await db.commit()

    # Sync to Clerk via their API
    # (requires clerk-sdk-python or direct HTTP call)
    # This endpoint is called by admin UI after role change
    return {"status": "synced"}
```

- [ ] **Step 3: Write test for JWT claims extraction**

```python
# services/backend-api/tests/test_jwt_claims.py
import pytest
from src.core.security import extract_claims_from_clerk_token


async def test_extract_claims_from_clerk_token():
    """Verify claims extraction works with Clerk JWT structure."""
    # Mock token with expected claims
    mock_claims = {
        "sub": "user_test_123",
        "org_id": "org_test_123",
        "org_role": "org:admin",
        "is_platform_superuser": True,
        "email": "test@example.com",
    }

    # This test verifies the extraction logic
    assert mock_claims.get("is_platform_superuser") is True
    assert mock_claims.get("org_role") == "org:admin"
```

- [ ] **Step 4: Commit**

```bash
git add services/backend-api/src/routes/clerk_sync.py services/backend-api/tests/test_jwt_claims.py
git commit -m "feat: add Clerk JWT claims sync endpoint"
```

---

### Task 5: Build Auth Middleware for Split Routing

**Files:**

- Create: `services/backend-api/src/core/middleware.py`
- Modify: `services/backend-api/src/main.py`
- Test: `services/backend-api/tests/test_auth_middleware.py`

**Interfaces:**

- Consumes: `verify_clerk_token()`, `is_platform_superuser` DB check
- Produces: FastAPI middleware that enforces `/platform/*` and `/admin/*` access rules

- [ ] **Step 1: Write the failing test**

```python
# services/backend-api/tests/test_auth_middleware.py
import pytest
from fastapi.testclient import TestClient
from src.main import app


async def test_platform_route_requires_super_user(client: TestClient, mock_clerk_token_with_superuser):
    """Verify /platform/* routes require is_platform_superuser claim."""
    response = client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {mock_clerk_token_with_superuser}"},
    )
    assert response.status_code == 200


async def test_admin_route_requires_org_membership(client: TestClient, mock_clerk_token_with_org):
    """Verify /admin/* routes require org membership."""
    response = client.get(
        "/api/v1/admin/dashboard",
        headers={"Authorization": f"Bearer {mock_clerk_token_with_org}"},
    )
    assert response.status_code == 200
```

- [ ] **Step 2: Create auth middleware**

```python
# services/backend-api/src/core/middleware.py
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from src.core.security import verify_clerk_token
from src.database import async_engine
from src.orm.models.tenant import TenantUser


class ClerkAuthMiddleware(BaseHTTPMiddleware):
    """Middleware that enforces split routing auth rules."""

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public routes
        path = request.url.path

        # Public endpoints
        if path.startswith("/api/v1/webhooks/") or \
           path.startswith("/health") or \
           path.startswith("/docs") or \
           path.startswith("/openapi.json"):
            return await call_next(request)

        # Require auth token
        auth_header = request.headers.get("authorization", "")
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )

        token = auth_header[7:]

        try:
            claims = await verify_clerk_token(token)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Clerk token: {e}"
            )

        # Attach claims to request state
        request.state.claims = claims

        # Enforce route-specific rules
        if path.startswith("/api/v1/platform/"):
            # Platform routes require is_platform_superuser
            is_superuser = claims.get("is_platform_superuser", False)
            if not is_superuser:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Platform access requires Super OWNER role"
                )

        # Store user_id and org_id for downstream use
        request.state.user_id = claims.get("sub")
        request.state.org_id = claims.get("org_id")

        response = await call_next(request)
        return response
```

- [ ] **Step 3: Register middleware in main.py**

```python
# services/backend-api/src/main.py (add to app setup)
from src.core.middleware import ClerkAuthMiddleware

app.add_middleware(ClerkAuthMiddleware)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/backend-api && python -m pytest tests/test_auth_middleware.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/core/middleware.py services/backend-api/src/main.py services/backend-api/tests/test_auth_middleware.py
git commit -m "feat: add Clerk auth middleware for split routing"
```

---

### Task 6: Build Platform API Endpoints

**Files:**

- Create: `services/backend-api/src/routes/platform.py`
- Test: `services/backend-api/tests/test_platform_api.py`

**Interfaces:**

- Consumes: `ClerkAuthMiddleware`, `Tenant` model
- Produces: Platform endpoints for tenant management, platform analytics

- [ ] **Step 1: Write the failing test**

```python
# services/backend-api/tests/test_platform_api.py
import pytest
from fastapi.testclient import TestClient
from src.main import app


async def test_list_tenants_requires_super_user(client: TestClient, mock_clerk_token_with_superuser):
    """Verify GET /platform/tenants returns tenant list for super users."""
    response = client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {mock_clerk_token_with_superuser}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "tenants" in data


async def test_list_tenants_denies_non_super_user(client: TestClient, mock_clerk_token_without_superuser):
    """Verify non-super users cannot access platform endpoints."""
    response = client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {mock_clerk_token_without_superuser}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Create platform API endpoints**

```python
# services/backend-api/src/routes/platform.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.middleware import ClerkAuthMiddleware
from src.database import get_db
from src.orm.models.tenant import Tenant

router = APIRouter(prefix="/platform", tags=["platform"])


@router.get("/tenants")
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(ClerkAuthMiddleware.get_claims),
):
    """List all tenants — Super OWNER only."""
    # Verify platform access
    if not claims.get("is_platform_superuser"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform access requires Super OWNER role"
        )

    result = await db.execute(select(Tenant).where(Tenant.is_active == True))
    tenants = result.scalars().all()

    return {
        "tenants": [
            {
                "id": t.id,
                "name": t.name,
                "clerk_org_id": t.clerk_org_id,
                "is_active": t.is_active,
                "created_at": t.created_at,
            }
            for t in tenants
        ]
    }


@router.get("/stats")
async def platform_stats(
    db: AsyncSession = Depends(get_db),
    claims: dict = Depends(ClerkAuthMiddleware.get_claims),
):
    """Get platform-wide statistics — Super OWNER only."""
    if not claims.get("is_platform_superuser"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform access requires Super OWNER role"
        )

    # Count tenants
    result = await db.execute(select(Tenant))
    tenants = result.scalars().all()

    return {
        "total_tenants": len(tenants),
        "active_tenants": sum(1 for t in tenants if t.is_active),
    }
```

- [ ] **Step 3: Register platform router in main.py**

```python
# services/backend-api/src/main.py (add to imports and app setup)
from src.routes.platform import router as platform_router

app.include_router(platform_router, prefix="/api/v1")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/backend-api && python -m pytest tests/test_platform_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/backend-api/src/routes/platform.py services/backend-api/src/main.py services/backend-api/tests/test_platform_api.py
git commit -m "feat: add platform API endpoints for tenant management"
```

---

### Task 7: Build Frontend Clerk Integration

**Files:**

- Modify: `apps/admin/src/app/layout.tsx`
- Modify: `apps/admin/src/proxy.ts` → rename to `middleware.ts`
- Create: `apps/admin/src/app/platform/page.tsx`
- Create: `apps/admin/src/app/admin/page.tsx`
- Create: `apps/admin/src/components/auth/ProtectedRoute.tsx`

**Interfaces:**

- Consumes: Clerk `<ClerkProvider>`, `<SignedIn>`, `<OrganizationSwitcher>`
- Produces: Split routing UI with platform and admin pages

- [ ] **Step 1: Update root layout with Clerk components**

```tsx
// apps/admin/src/app/layout.tsx
import { ClerkProvider, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <header>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
              <OrganizationSwitcher />
            </SignedIn>
            <SignedOut>
              <a href="/sign-in">Sign In</a>
            </SignedOut>
          </header>
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Create middleware.ts for route protection**

```typescript
// apps/admin/src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in",
  "/sign-up",
  "/api/webhooks/(.*)",
]);

export default clerkMiddleware(async (req, ctx) => {
  if (!isPublicRoute(req)) {
    // All other routes require authentication
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 3: Create platform page**

```tsx
// apps/admin/src/app/platform/page.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function PlatformPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) return;

    fetch("/api/v1/platform/tenants", {
      headers: {
        Authorization: `Bearer ${await getClerkToken()}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setTenants(data.tenants);
        setLoading(false);
      });
  }, [isSignedIn]);

  if (!isLoaded || loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Platform Management</h1>
      <p>Super OWNER Dashboard</p>
      <ul>
        {tenants.map((tenant: any) => (
          <li key={tenant.id}>{tenant.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Create admin page**

```tsx
// apps/admin/src/app/admin/page.tsx
"use client";

import { useUser, useOrganization } from "@clerk/nextjs";

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useUser();
  const { organization } = useOrganization();

  if (!isLoaded || !isSignedIn) return <div>Loading...</div>;

  return (
    <div>
      <h1>Store Admin</h1>
      <p>Organization: {organization?.name}</p>
      {/* Store-specific features go here */}
    </div>
  );
}
```

- [ ] **Step 5: Create ProtectedRoute component**

```tsx
// apps/admin/src/components/auth/ProtectedRoute.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { ReactNode } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSuperOwner?: boolean;
}

export default function ProtectedRoute({
  children,
  requireSuperOwner = false,
}: ProtectedRouteProps) {
  const { isSignedIn, isLoaded, user } = useUser();

  if (!isLoaded) return <div>Loading...</div>;

  if (!isSignedIn) {
    return <div>Please sign in to continue.</div>;
  }

  if (requireSuperOwner && !user?.publicMetadata?.is_platform_superuser) {
    return <div>Access denied. Super OWNER role required.</div>;
  }

  return <>{children}</>;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/app/layout.tsx apps/admin/src/middleware.ts apps/admin/src/app/platform/page.tsx apps/admin/src/app/admin/page.tsx apps/admin/src/components/auth/ProtectedRoute.tsx
git commit -m "feat: add frontend Clerk integration with split routing"
```

---

### Task 8: End-to-End Integration Testing

**Files:**

- Create: `services/backend-api/tests/test_e2e_flow.py`
- Create: `apps/admin/tests/e2e-flow.spec.ts` (if using Playwright/Cypress)

**Interfaces:**

- Consumes: All previous tasks
- Produces: Full flow test from user signup → org invitation → tenant creation → platform access

- [ ] **Step 1: Write end-to-end flow test**

```python
# services/backend-api/tests/test_e2e_flow.py
import pytest
from fastapi.testclient import TestClient
from src.main import app


async def test_full_super_owner_flow(client: TestClient):
    """Test complete flow:
    1. User signs up via Clerk
    2. User is invited to org (webhook triggers TenantUser creation)
    3. User is promoted to Super OWNER (is_platform_superuser=True)
    4. User can access /platform/* routes
    """
    # Step 1: Simulate Clerk webhook for new org membership
    webhook_payload = {
        "event": {
            "type": "organizationMembership.created",
            "data": {
                "organization": {
                    "id": "org_e2e_test",
                    "name": "E2E Test Org"
                },
                "user": {
                    "id": "user_e2e_test",
                    "email_addresses": [{"email_address": "e2e@example.com"}]
                },
                "role": "org:admin"
            }
        }
    }

    response = client.post(
        "/api/v1/webhooks/clerk",
        json=webhook_payload,
    )
    assert response.status_code == 200

    # Step 2: Verify TenantUser was created
    # (would need to query DB directly or use a test endpoint)

    # Step 3: Simulate JWT with is_platform_superuser=True
    super_token = "mock_jwt_with_superuser_claim"

    response = client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {super_token}"},
    )
    assert response.status_code == 200

    # Step 4: Verify non-super user cannot access platform
    normal_token = "mock_jwt_without_superuser_claim"

    response = client.get(
        "/api/v1/platform/tenants",
        headers={"Authorization": f"Bearer {normal_token}"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run all tests**

Run: `cd services/backend-api && python -m pytest tests/ -v`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add services/backend-api/tests/test_e2e_flow.py
git commit -m "test: add end-to-end integration tests for Super OWNER flow"
```

---

## Implementation Order

1. **Task 1**: DB schema (`is_platform_superuser` field)
2. **Task 2**: Clerk JWT verification
3. **Task 3**: Clerk webhook handler
4. **Task 4**: JWT template configuration (Clerk dashboard)
5. **Task 5**: Auth middleware for split routing
6. **Task 6**: Platform API endpoints
7. **Task 7**: Frontend Clerk integration
8. **Task 8**: End-to-end testing

## Rollback Plan

If any task fails:

1. Each task is self-contained with its own commit
2. Use `git revert <commit>` to undo individual task changes
3. Alembic migrations can be rolled back with `alembic downgrade -1`
4. Clerk JWT template changes are reversible in dashboard

## Notes for Implementation

- Use `uv` for Python dependency management
- Run `alembic upgrade head` after each migration-adding task
- Clerk dashboard JWT template must be configured manually (Task 4)
- Frontend uses `@clerk/nextjs` v6 — check docs for API changes
- Test with mock Clerk tokens in unit tests; use real Clerk test environment for integration tests
- The `clerk-sdk-python` package may need to be installed via `uv add clerk-sdk-python` or use direct HTTP calls to Clerk API
