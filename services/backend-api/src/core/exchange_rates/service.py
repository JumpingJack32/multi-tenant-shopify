from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import json
import logging
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import settings
from src.core.cache import redis_client
from src.core.exchange_rates.interface import ExchangeRateData
from src.core.exchange_rates.models import ExchangeRate
from src.core.exchange_rates.providers import get_provider

logger = logging.getLogger(__name__)

CACHE_PREFIX = "fx"
CACHE_TTL = settings.exchange_rate_refresh_hours * 3600

MINOR_UNITS: dict[str, int] = {
    "JPY": 0, "KRW": 0, "VND": 0, "IDR": 0,
    "BHD": 3, "KWD": 3, "OMR": 3,
}

BASE_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD", "NZD", "CHF",
                   "CNY", "INR", "MXN", "BRL", "SEK", "NOK", "DKK",
                   "SGD", "HKD", "TWD", "THB", "MYR", "PHP", "PLN",
                   "CZK", "HUF", "ILS", "TRY", "ZAR", "AED", "SAR"}


def get_minor_unit(currency: str) -> int:
    return MINOR_UNITS.get(currency.upper(), 2)


class RateService:
    @staticmethod
    def _cache_key(source: str, target: str) -> str:
        return f"{CACHE_PREFIX}:rate:{source.upper()}:{target.upper()}"

    @staticmethod
    def _all_rates_cache_key(base: str) -> str:
        return f"{CACHE_PREFIX}:all:{base.upper()}"

    async def _get_cached_rate(self, source: str, target: str) -> Decimal | None:
        if not settings.redis_enabled:
            return None
        try:
            raw = await redis_client.client.get(self._cache_key(source, target))
            if raw:
                data: dict[str, Any] = json.loads(raw)
                return Decimal(str(data["rate"]))
        except Exception:
            logger.warning("Failed to read exchange rate from cache", exc_info=True)
        return None

    async def _set_cached_rate(self, source: str, target: str, rate: Decimal) -> None:
        if not settings.redis_enabled:
            return
        try:
            payload = json.dumps({"rate": str(rate)})
            await redis_client.client.setex(
                self._cache_key(source, target), CACHE_TTL, payload,
            )
        except Exception:
            logger.warning("Failed to write exchange rate to cache", exc_info=True)

    async def _get_db_rate(self, source: str, target: str, db: AsyncSession) -> Decimal | None:
        stmt = (
            select(ExchangeRate)
            .where(
                ExchangeRate.source_currency == source.upper(),
                ExchangeRate.target_currency == target.upper(),
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.scalar_one_or_none()
        return Decimal(str(row.rate)) if row else None

    async def _upsert_db_rate(
        self, source: str, target: str, rate: Decimal, db: AsyncSession,
    ) -> None:
        stmt = (
            select(ExchangeRate)
            .where(
                ExchangeRate.source_currency == source.upper(),
                ExchangeRate.target_currency == target.upper(),
            )
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            existing.rate = rate
        else:
            db.add(ExchangeRate(
                source_currency=source.upper(),
                target_currency=target.upper(),
                rate=rate,
            ))
        await db.commit()

    async def get_rate(self, from_currency: str, to_currency: str) -> Decimal:
        if from_currency.upper() == to_currency.upper():
            return Decimal("1")

        cached = await self._get_cached_rate(from_currency, to_currency)
        if cached is not None:
            return cached

        raise ValueError(
            f"No rate available for {from_currency} -> {to_currency}. "
            "Call refresh_rates() first.",
        )

    async def get_rate_or_db(
        self, from_currency: str, to_currency: str, db: AsyncSession,
    ) -> Decimal:
        if from_currency.upper() == to_currency.upper():
            return Decimal("1")

        cached = await self._get_cached_rate(from_currency, to_currency)
        if cached is not None:
            return cached

        db_rate = await self._get_db_rate(from_currency, to_currency, db)
        if db_rate is not None:
            await self._set_cached_rate(from_currency, to_currency, db_rate)
            return db_rate

        raise ValueError(
            f"No rate available for {from_currency} -> {to_currency}",
        )

    async def get_rate_bridged(
        self, from_currency: str, to_currency: str, db: AsyncSession,
    ) -> Decimal:
        if from_currency.upper() == to_currency.upper():
            return Decimal("1")

        try:
            return await self.get_rate_or_db(from_currency, to_currency, db)
        except ValueError:
            pass

        base = settings.exchange_rate_base_currency.upper()
        base_to_from = await self.get_rate_or_db(base, from_currency, db)
        base_to_to = await self.get_rate_or_db(base, to_currency, db)
        rate = (base_to_to / base_to_from).quantize(
            Decimal("0.00000001"), rounding=ROUND_HALF_UP,
        )
        await self._set_cached_rate(from_currency, to_currency, rate)
        return rate

    async def convert(
        self, amount: Decimal, from_currency: str, to_currency: str,
        db: AsyncSession,
    ) -> int:
        rate = await self.get_rate_bridged(from_currency, to_currency, db)
        units = get_minor_unit(to_currency)
        precision = Decimal("0." + "0" * units) if units > 0 else Decimal("1")
        converted = (amount * rate).quantize(precision, rounding=ROUND_HALF_UP)
        return int(converted * (10 ** units))

    async def refresh_rates(self, db: AsyncSession, base_currency: str | None = None) -> ExchangeRateData:
        base = (base_currency or settings.exchange_rate_base_currency).upper()
        provider = get_provider()
        data = await provider.fetch_latest(base)

        for target, rate in data.rates.items():
            await self._set_cached_rate(base, target, rate)
            await self._upsert_db_rate(base, target, rate, db)

        all_key = self._all_rates_cache_key(base)
        if settings.redis_enabled:
            try:
                all_payload = json.dumps({
                    "base_currency": data.base_currency,
                    "rates": {k: str(v) for k, v in data.rates.items()},
                    "timestamp": data.timestamp.isoformat(),
                })
                await redis_client.client.setex(all_key, CACHE_TTL, all_payload)
            except Exception:
                logger.warning("Failed to cache all rates in Redis", exc_info=True)

        logger.info(
            "Refreshed %d exchange rates for base %s",
            len(data.rates), base,
        )
        return data

    async def get_all_rates(
        self, base_currency: str, db: AsyncSession,
    ) -> ExchangeRateData | None:
        base = base_currency.upper()

        if settings.redis_enabled:
            try:
                raw = await redis_client.client.get(self._all_rates_cache_key(base))
                if raw:
                    data = json.loads(raw)
                    return ExchangeRateData(
                        base_currency=data["base_currency"],
                        rates={k: Decimal(v) for k, v in data["rates"].items()},
                        timestamp=datetime.fromisoformat(data["timestamp"]),
                    )
            except Exception:
                logger.warning("Failed to read all rates from cache", exc_info=True)

        stmt = (
            select(ExchangeRate)
            .where(ExchangeRate.source_currency == base)
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()
        if not rows:
            return None
        return ExchangeRateData(
            base_currency=base,
            rates={r.target_currency: r.rate for r in rows},
            timestamp=max(r.updated_at for r in rows),
        )
