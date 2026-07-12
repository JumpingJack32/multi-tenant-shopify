import json
import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from pydantic import BaseModel

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


class CurrencyAwareRoute(APIRoute):
    """APIRoute subclass that converts tagged price fields before serialization."""

    def get_route_handler(self) -> Callable:
        original_handler = super().get_route_handler()

        async def custom_handler(request: Request) -> Response:
            response: Response = await original_handler(request)

            target = getattr(request.state, "target_currency", None)
            if not target:
                return response
            if not isinstance(response, JSONResponse):
                return response
            response_model = self.response_model
            if not response_model:
                return response

            try:
                body = json.loads(response.body)
                base = getattr(request.state, "base_currency", "GBP")
                converter = PriceConverter(target, base)
                converted = await converter.convert_response(body, response_model)
                return JSONResponse(
                    content=converted,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            except Exception:
                logger.exception("Currency conversion failed, returning unconverted response")
                return response

        return custom_handler
