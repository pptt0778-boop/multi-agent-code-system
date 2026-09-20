"""Application settings loaded from environment / .env (Phase 1.1)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # LLM providers (server-side defaults; client keys take precedence)
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    deepseek_api_key: str = ""

    # GitHub
    github_token: str = ""
    github_default_repo: str = ""

    # Vault
    vault_secret: str = "change-me-to-a-32-byte-random-string"

    # Sandbox
    docker_host: str = ""
    sandbox_memory_mb: int = 512
    sandbox_timeout_s: int = 60
    sandbox_network: str = "none"

    # Server
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def provider_key(self, provider: str) -> str:
        return {
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "google": self.gemini_api_key,
            "gemini": self.gemini_api_key,
            "openrouter": self.openrouter_api_key,
            "deepseek": self.deepseek_api_key,
        }.get(provider, "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
