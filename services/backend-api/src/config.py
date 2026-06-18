from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None)

    supabase_url: str
    supabase_key: str
    clerk_secret_key: str
    clerk_publishable_key: str
    svix_webhook_secret: str
    doppler_pr: str

    @property
    def is_production(self) -> bool:
        return self.doppler_pr == "prod"
