from src.core.exchange_rates.interface import ExchangeRateProvider
from src.config import settings

_providers: dict[str, type[ExchangeRateProvider]] = {}


def register_provider(name: str, provider_cls: type[ExchangeRateProvider]) -> None:
    _providers[name] = provider_cls


def get_provider() -> ExchangeRateProvider:
    name = settings.exchange_rate_provider
    cls = _providers.get(name)
    if not cls:
        raise ValueError(f"Unknown exchange rate provider: {name!r}")
    return cls()


# Import providers so they register themselves with the factory
import src.core.exchange_rates.providers.frankfurter  # noqa: F401, E402
import src.core.exchange_rates.providers.open_exchange  # noqa: F401, E402
