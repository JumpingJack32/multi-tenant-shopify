from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None)

    # Database
    database_url: str

    # Upstash Redis
    redis_url: Optional[str] = None
    redis_enabled: bool = False

    # Clerk
    clerk_secret_key: str
    clerk_publishable_key: str
    clerk_webhook_secret: str
    clerk_jwks_url: str

    # JWT
    jwt_secret: str

    # Svix (optional)
    svix_webhook_secret: Optional[str] = None

    # Shopify (optional)
    shopify_webhook_secret: Optional[str] = None

    # Stripe (optional)
    stripe_secret_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_api_version: str = "2024-12-18.acacia"
    use_checkout_sessions: bool = True

    # Doppler project reference
    doppler_pr: str = "dev"

    # Exchange Rates
    exchange_rate_provider: str = "frankfurter"
    exchange_rate_api_key: str | None = None
    exchange_rate_refresh_hours: int = 6
    exchange_rate_base_currency: str = "GBP"

    # Resend (optional — for production email)
    resend_api_key: str | None = None
    resend_from_email: str = "noreply@yourplatform.com"

    # AI (optional)
    ai_provider: str = "ollama"
    openrouter_api_key: str | None = None
    openai_api_key: str | None = None

    # Sentry (optional)
    sentry_dsn: str | None = None

    # App
    app_env: str = "development"
    debug: bool = False
    allowed_origins: str = "*"
    tenant_isolation_enabled: bool = True

    @property
    def is_production(self) -> bool:
        return self.doppler_pr == "prod"

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"
    
    @property
    def stripe_enabled(self) -> bool:
        return self.stripe_secret_key is not None and not self.stripe_secret_key.startswith("sk_test_placeholder")
    
    @property
    def svix_enabled(self) -> bool:
        return self.svix_webhook_secret is not None and not self.svix_webhook_secret.startswith("whsec_placeholder")


settings = Settings()  # type: ignore[call-arg]