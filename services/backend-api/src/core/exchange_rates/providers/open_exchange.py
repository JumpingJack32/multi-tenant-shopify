from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

import httpx

from src.config import settings
from src.core.exchange_rates.interface import (
    ExchangeRateData,
    ExchangeRateProvider,
)
from src.core.exchange_rates.providers import register_provider


class OpenExchangeRatesProvider(ExchangeRateProvider):
    BASE_URL = "https://openexchangerates.org/api"

    def __init__(self) -> None:
        self.api_key = settings.exchange_rate_api_key
        if not self.api_key:
            raise ValueError(
                "EXCHANGE_RATE_API_KEY is required for Open Exchange Rates provider"
            )

    async def fetch_latest(self, base_currency: str = "USD") -> ExchangeRateData:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/latest.json",
                params={"app_id": self.api_key},
                timeout=10,
            )
            resp.raise_for_status()
            body = resp.json()

        rates = {k: Decimal(str(v)) for k, v in body["rates"].items()}
        requested_base = base_currency.upper()

        if requested_base != "USD":
            base_rate = rates.get(requested_base)
            if not base_rate:
                raise ValueError(
                    f"Base currency {requested_base} not found in OER rates"
                )
            converted: dict[str, Decimal] = {}
            for curr, rate in rates.items():
                if curr == requested_base:
                    continue
                converted[curr] = (rate / base_rate).quantize(
                    Decimal("0.00000001"), rounding=ROUND_HALF_UP,
                )
            rates = converted

        return ExchangeRateData(
            base_currency=requested_base,
            rates=rates,
            timestamp=datetime.fromtimestamp(body["timestamp"]),
        )


register_provider("open_exchange", OpenExchangeRatesProvider)
