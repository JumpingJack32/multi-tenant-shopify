from datetime import datetime
from decimal import Decimal

import httpx

from src.core.exchange_rates.interface import (
    ExchangeRateData,
    ExchangeRateProvider,
)
from src.core.exchange_rates.providers import register_provider


class FrankfurterProvider(ExchangeRateProvider):
    BASE_URL = "https://api.frankfurter.dev/v1"

    async def fetch_latest(self, base_currency: str = "USD") -> ExchangeRateData:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.BASE_URL}/latest",
                params={"from": base_currency},
                timeout=10,
            )
            resp.raise_for_status()
            body = resp.json()
            return ExchangeRateData(
                base_currency=body["base"],
                rates={
                    k: Decimal(str(v))
                    for k, v in body["rates"].items()
                },
                timestamp=datetime.fromisoformat(body["date"]),
            )


register_provider("frankfurter", FrankfurterProvider)
