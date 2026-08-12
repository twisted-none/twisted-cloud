from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    admin_email: str
    admin_password: str
    keycloak_issuer_url: str = "https://vault-auth.176.108.255.248.sslip.io/realms/twisted-vault"
    keycloak_jwks_url: str = "http://keycloak:8080/realms/twisted-vault/protocol/openid-connect/certs"
    keycloak_client_id: str = "twisted-vault-frontend"
    allow_registration: bool = False
    media_root: str = "/data/media"
    access_token_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    trash_purge_interval_seconds: int = 60 * 60 * 24

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
