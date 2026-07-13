from abc import ABC, abstractmethod
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class ExchangeRateData(BaseModel):
    base_currency: str
    rates: dict[str, Decimal]
    timestamp: datetime


class ExchangeRateProvider(ABC):
    @abstractmethod
    async def fetch_latest(self, base_currency: str = "USD") -> ExchangeRateData:
        ...
