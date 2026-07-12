import logging
import types
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from pydantic import BaseModel
from starlette.datastructures import State
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from src.core.exchange_rates.service import RateService

logger = logging.getLogger(__name__)

PRICE_TAG = "is_price"


def _list_child_type(model: type) -> type | None:
    """Extract the child type from a list annotation like list[Model]."""
    if hasattr(model, "__origin__") and model.__origin__ is list:
        args = getattr(model, "__args__", None)
        if args:
            return args[0]
    return None


def _list_child_from_field(field_info: Any) -> type | None:
    """Extract the child type from a Field's annotation that is a list."""
    annotation = getattr(field_info, "annotation", None)
    if annotation is not None:
        return _list_child_type(annotation)
    try:
        origin = field_info.origin
        if origin is list:
            args = field_info.args
            return args[0] if args else None
    except Exception:
        pass
    return None


def _apply_rate(cents: int, rate: Decimal) -> int:
    """Convert a price in cents using a rate. Both input and output are cents."""
    if rate == Decimal("1"):
        return cents
    return int((Decimal(cents) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


class PriceConverter:
    """Converts price fields in response data from base currency to target currency."""

    def __init__(self, target_currency: str, base_currency: str = "GBP") -> None:
        self.target = target_currency.upper()
        self.base = base_currency.upper()
        self._rate_service = RateService()

    async def convert_response(self, data: Any, model: type | None = None) -> Any:
        if not data:
            return data

        if self.target == self.base:
            return data

        if isinstance(data, list) and model:
            child = _list_child_type(model) or _list_child_from_field(model)
            if child:
                return [await self.convert_response(item, child) for item in data]
            return data

        if isinstance(data, dict) and model and isinstance(model, type) and issubclass(model, BaseModel):
            return await self._convert_model(data, model)

        if isinstance(data, BaseModel):
            return await self._convert_model(
                data.model_dump(), type(data),
            )

        return data

    async def _convert_model(self, data: dict, model: type[BaseModel]) -> dict:
        result = dict(data)

        for name, field_info in model.model_fields.items():
            if name not in data:
                continue

            extra = field_info.json_schema_extra or {}
            if extra.get(PRICE_TAG) and isinstance(data[name], int):
                try:
                    rate = await self._rate_service.get_rate(self.base, self.target)
                    result[name] = _apply_rate(data[name], rate)
                except ValueError:
                    logger.warning(
                        "No rate for %s->%s; keeping original price for %s.%s",
                        self.base, self.target, model.__name__, name,
                    )

            child_model = self._child_model(field_info)
            if child_model and isinstance(data[name], dict):
                result[name] = await self._convert_model(data[name], child_model)
            elif child_model and isinstance(data[name], list):
                result[name] = [
                    await self._convert_model(item, child_model)
                    if isinstance(item, dict)
                    else item
                    for item in data[name]
                ]

        return result

    @staticmethod
    def _child_model(field_info: Any) -> type | None:
        if hasattr(field_info, "annotation") and field_info.annotation:
            annotation = field_info.annotation
            if hasattr(annotation, "__origin__") and annotation.__origin__ is list:
                args = getattr(annotation, "__args__", None)
                if args and isinstance(args[0], type) and issubclass(args[0], BaseModel):
                    return args[0]
            if isinstance(annotation, type) and issubclass(annotation, BaseModel):
                return annotation
        return None


class CurrencyAwareRoute(Route):
    """APIRoute subclass that applies PriceConverter to storefront responses."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)

    async def handle(self, scope: Scope, receive: Receive, send: Send) -> None:
        state: State = scope.get("state") or State()
        state = scope.get("app").state if hasattr(scope.get("app"), "state") else state
        base_currency: str = getattr(state, "base_currency", "GBP")
        target_currency: str = getattr(state, "target_currency", "GBP")

        original_send = send

        async def patched_send(message: dict) -> None:
            if message["type"] == "http.response.start":
                pass
            elif message["type"] == "http.response.body" and message.get("body"):
                body = message["body"]
                try:
                    import json as json_mod
                    data = json_mod.loads(body)
                    if isinstance(data, (dict, list)):
                        converter = PriceConverter(
                            target_currency=target_currency,
                            base_currency=base_currency,
                        )
                        converted = await converter.convert_response(
                            data, model=self.response_model,
                        )
                        message["body"] = json_mod.dumps(converted).encode("utf-8")
                except Exception:
                    logger.exception("Failed to convert response prices")
            await original_send(message)

        await super().handle(scope, receive, patched_send)
