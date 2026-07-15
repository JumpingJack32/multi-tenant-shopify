from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from src.core.cache import blacklist_jwt
from src.core.security import create_access_token, create_refresh_token, decode_token
from src.dependencies import get_db
from src.orm.models.order import Customer

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)


class RegisterResponse(BaseModel):
    user_id: UUID
    email: str
    tenant_id: UUID


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db=Depends(get_db)):
    """Register a new customer account."""
    from sqlmodel import select

    # Check if customer already exists
    stmt = select(Customer).where(Customer.email == payload.email)
    result = await db.exec(stmt)
    existing = result.one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new customer
    customer = Customer(
        email=payload.email,
        password_hash=pwd_context.hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        tenant_id=UUID("00000000-0000-0000-0000-000000000000"),  # Default tenant for customers
    )
    db.add(customer)
    await db.flush()
    await db.refresh(customer)

    return RegisterResponse(
        user_id=customer.id,
        email=customer.email,
        tenant_id=customer.tenant_id,
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db=Depends(get_db)):
    """Authenticate and return JWT tokens."""
    from sqlmodel import select

    # Find customer by email
    stmt = select(Customer).where(Customer.email == payload.email)
    result = await db.exec(stmt)
    customer = result.one_or_none()

    if not customer or not pwd_context.verify(payload.password, customer.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Create tokens
    access_token = create_access_token(
        data={"sub": str(customer.id), "email": customer.email, "tenant_id": str(customer.tenant_id)},
    )
    refresh_token = create_refresh_token(
        data={"sub": str(customer.id), "email": customer.email, "tenant_id": str(customer.tenant_id)},
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(token: str = Depends(oauth2_scheme)):
    """Refresh an access token using a refresh token."""
    # Decode the refresh token
    payload = decode_token(token)

    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    # Check if token is blacklisted
    jti = payload.get("jti")
    if jti and await blacklist_jwt(jti, 0):  # This is a bit odd, but we check if it's blacklisted
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been blacklisted",
        )

    # Create new tokens
    access_token = create_access_token(
        data={"sub": payload["sub"], "email": payload["email"], "tenant_id": payload["tenant_id"]},
    )
    new_refresh_token = create_refresh_token(
        data={"sub": payload["sub"], "email": payload["email"], "tenant_id": payload["tenant_id"]},
    )

    return LoginResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(token: str = Depends(oauth2_scheme)):
    """Logout and blacklist the current token."""
    payload = decode_token(token)

    if payload:
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            await blacklist_jwt(jti, exp)
