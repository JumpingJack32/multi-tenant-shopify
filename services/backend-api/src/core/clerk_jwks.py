from __future__ import annotations

import base64
import time
from typing import Any

import httpx
import jwt
from cryptography.hazmat.primitives.asymmetric.ec import (
    SECP256R1,
    EllipticCurvePublicKey,
)

from src.config import settings


class _JwksCache:
    """Simple in-memory TTL cache for Clerk JWKS."""

    def __init__(self, ttl: int = 3600) -> None:
        self._keys: dict[str, EllipticCurvePublicKey] = {}
        self._expires: float = 0.0
        self._ttl = ttl
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    async def fetch(self) -> dict[str, Any]:
        if time.monotonic() < self._expires:
            return self._keys
        resp = await self.client.get(settings.clerk_jwks_url)
        resp.raise_for_status()
        jwks = resp.json()
        self._keys.clear()
        for key in jwks.get("keys", []):
            if key.get("kty") == "EC" and key.get("crv") == "P-256":
                x = int.from_bytes(self._b64url(key["x"]), "big")
                y = int.from_bytes(self._b64url(key["y"]), "big")
                pub_key = EllipticCurvePublicKey.from_encoded_point(
                    SECP256R1(),
                    (x, y),
                )
                self._keys[key["kid"]] = pub_key
        self._expires = time.monotonic() + self._ttl
        return self._keys

    @staticmethod
    def _b64url(val: str) -> bytes:
        padded = val + "=" * (4 - len(val) % 4)
        return base64.urlsafe_b64decode(padded)


_jwks = _JwksCache()


async def verify_clerk_token(token: str) -> dict[str, Any]:
    """Verify a Clerk Bearer token using JWKS RS256."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if not kid:
        raise ValueError("Token missing 'kid' in header")

    keys = await _jwks.fetch()
    pub_key = keys.get(kid)
    if pub_key is None:
        raise ValueError(f"No JWKS key found for kid={kid}")

    payload = jwt.decode(
        token,
        pub_key,
        algorithms=["RS256"],
        options={"verify_exp": True},
    )
    return payload
