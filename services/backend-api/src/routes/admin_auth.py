from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
import bcrypt
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.core.cache import blacklist_jwt, is_jwt_blacklisted
from src.core.security import create_access_token, create_refresh_token, decode_token
from src.dependencies import get_db
from src.orm.models.tenant import Tenant, TenantStatus, TenantUser

router = APIRouter(prefix="/admin/auth", tags=["admin auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/admin/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


class AdminRegisterRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    tenant_slug: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AdminRefreshRequest(BaseModel):
    refresh_token: str


class AdminUserResponse(BaseModel):
    user_id: UUID
    email: str
    tenant_id: UUID
    role: str
    is_active: bool


@router.post("/register", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: AdminRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new tenant admin user."""
    # Find or create tenant
    stmt = select(Tenant).where(Tenant.slug == payload.tenant_slug)
    result = await db.exec(stmt)
    tenant = result.one_or_none()

    if not tenant:
        tenant = Tenant(
            name=payload.tenant_slug.title(),
            slug=payload.tenant_slug,
            status=TenantStatus.ACTIVE,
        )
        db.add(tenant)
        await db.flush()

    # Check if admin already exists
    stmt = select(TenantUser).where(
        TenantUser.email == payload.email,
        TenantUser.tenant_id == tenant.id,
    )
    result = await db.exec(stmt)
    existing = result.one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered for this tenant",
        )

    # Create admin user
    admin = TenantUser(
        tenant_id=tenant.id,
        clerk_user_id=str(uuid4()),
        email=payload.email,
        password_hash=hash_password(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(admin)
    await db.flush()
    await db.refresh(admin)

    return AdminUserResponse(
        user_id=admin.id,
        email=admin.email,
        tenant_id=admin.tenant_id,
        role=admin.role,
        is_active=admin.is_active,
    )


@router.post("/login", response_model=AdminTokenResponse)
async def login(payload: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate tenant admin and return JWT tokens."""
    stmt = select(TenantUser).where(
        TenantUser.email == payload.email,
        TenantUser.is_active == True,  # noqa: E712
    )
    result = await db.exec(stmt)
    admin = result.one_or_none()

    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token = create_access_token(
        data={
            "sub": str(admin.id),
            "email": admin.email,
            "tenant_id": str(admin.tenant_id),
            "role": admin.role,
            "token_type": "admin",
        },
    )
    refresh_token = create_refresh_token(
        data={
            "sub": str(admin.id),
            "email": admin.email,
            "tenant_id": str(admin.tenant_id),
            "role": admin.role,
            "token_type": "admin",
        },
    )

    return AdminTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=AdminTokenResponse)
async def refresh(payload: AdminRefreshRequest):
    """Refresh an access token using a refresh token."""
    try:
        payload_data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if not payload_data or payload_data.get("token_type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    jti = payload_data.get("jti")
    if jti:
        blacklisted = await is_jwt_blacklisted(jti)
        if blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been blacklisted",
            )

    access_token = create_access_token(
        data={
            "sub": payload_data["sub"],
            "email": payload_data["email"],
            "tenant_id": payload_data["tenant_id"],
            "role": payload_data["role"],
            "token_type": "admin",
        },
    )
    new_refresh_token = create_refresh_token(
        data={
            "sub": payload_data["sub"],
            "email": payload_data["email"],
            "tenant_id": payload_data["tenant_id"],
            "role": payload_data["role"],
            "token_type": "admin",
        },
    )

    return AdminTokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: str = Depends(oauth2_scheme)):
    """Logout and blacklist the current token."""
    try:
        payload_data = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    if payload_data:
        jti = payload_data.get("jti")
        exp = payload_data.get("exp")
        if jti and exp:
            await blacklist_jwt(jti, exp)


@router.get("/me", response_model=AdminUserResponse)
async def me(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Get current admin user info."""
    try:
        payload_data = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )

    if not payload_data or payload_data.get("token_type") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )

    jti = payload_data.get("jti")
    if jti:
        blacklisted = await is_jwt_blacklisted(jti)
        if blacklisted:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been blacklisted",
            )

    admin_id = payload_data.get("sub")
    if not admin_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identifier",
        )

    stmt = select(TenantUser).where(TenantUser.id == UUID(admin_id))
    result = await db.exec(stmt)
    admin = result.one_or_none()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found",
        )

    return AdminUserResponse(
        user_id=admin.id,
        email=admin.email,
        tenant_id=admin.tenant_id,
        role=admin.role,
        is_active=admin.is_active,
    )


@router.post("/verify", response_model=AdminUserResponse)
async def verify(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """Verify admin token and return user info (alias for /me)."""
    try:
        payload_data = decode_token(token)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
    return await me(token, db)
