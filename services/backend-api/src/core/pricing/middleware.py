"""Middleware that extracts consumer currency preference from request."""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class CurrencyExtractorMiddleware(BaseHTTPMiddleware):
    """Reads preferred_currency cookie or X-Currency header, sets request.state."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        target = (
            request.headers.get("X-Currency")
            or request.cookies.get("preferred_currency")
        )
        request.state.target_currency = target.strip().upper() if target else None
        if not hasattr(request.state, "base_currency") or not request.state.base_currency:
            request.state.base_currency = "GBP"
        return await call_next(request)
