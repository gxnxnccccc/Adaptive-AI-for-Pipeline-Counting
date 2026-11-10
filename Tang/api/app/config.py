from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cors_origins: list[str] = ["http://localhost:5173"]
    supabase_url: str = ""
    supabase_secret_key: str = ""
    supabase_bucket: str = "pipe-images"
    demo_memory: bool = False  # DEMO_MEMORY=true: keep data in RAM when no Supabase keys (Docker demo)
    max_files_per_request: int = 10
    max_file_bytes: int = 15 * 1024 * 1024


settings = Settings()
