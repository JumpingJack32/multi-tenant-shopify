from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from jose import JWTError, jwt as pyjwt

from src.config import settings


ALGORITHM = "HS256"


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "type": "access", "jti": str(uuid4())})
    return pyjwt.encode(to_encode, settings.clerk_secret_key, algorithm=ALGORITHM)


def create_refresh_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(UTC) + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": expire, "type": "refresh", "jti": str(uuid4())})
    return pyjwt.encode(to_encode, settings.clerk_secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify a JWT token."""
    try:
        payload = pyjwt.decode(token, settings.clerk_secret_key, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
