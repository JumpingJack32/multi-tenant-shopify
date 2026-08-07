"""Clerk backend API helpers (invitations, user lookup)."""

from src.config import settings


async def create_clerk_invitation(
    email: str,
    public_metadata: dict,
    redirect_url: str,
) -> str:
    """Create a Clerk organization invitation via the Backend API.

    Returns the invitation id. Requires CLERK_SECRET_KEY to be set; raises a
    RuntimeError when Clerk is not configured so callers can degrade gracefully
    in development.
    """
    if not settings.clerk_secret_key or settings.clerk_secret_key.startswith("sk_test_placeholder"):
        raise RuntimeError("CLERK_SECRET_KEY not configured")

    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.clerk.com/v1/invitations",
            headers={
                "Authorization": f"Bearer {settings.clerk_secret_key}",
                "Content-Type": "application/json",
            },
            json={
                "email_address": email,
                "public_metadata": public_metadata,
                "redirect_url": redirect_url,
            },
        )
        resp.raise_for_status()
        return resp.json()["id"]


async def get_clerk_user_email(user_id: str) -> str | None:
    """Resolve a Clerk user id to its primary email address."""
    if not settings.clerk_secret_key or settings.clerk_secret_key.startswith("sk_test_placeholder"):
        return None

    import httpx

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        email = data.get("primary_email_address_id")
        for addr in data.get("email_addresses", []):
            if addr.get("id") == email:
                return addr.get("email_address")
        return None
