from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file's directory (immune to CWD changes)
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(alias="SUPABASE_SERVICE_ROLE_KEY")
    allowed_origins: str = Field(default="http://localhost:5173", alias="ALLOWED_ORIGINS")
    default_history_hours: int = Field(default=24, alias="DEFAULT_HISTORY_HOURS")
    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_phone_from: str = Field(default="", alias="TWILIO_PHONE_FROM")
    twilio_phone_to: str = Field(default="", alias="TWILIO_PHONE_TO")
    device_id: str = Field(default="", alias="DEVICE_ID")

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def twilio_enabled(self) -> bool:
        return bool(
            self.twilio_account_sid
            and self.twilio_auth_token
            and self.twilio_phone_from
            and self.twilio_phone_to
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

