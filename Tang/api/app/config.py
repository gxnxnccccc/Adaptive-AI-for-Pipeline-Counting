"""Settings read from api/.env (gitignored) or the process environment."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

_DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", _DEFAULT_ORIGINS)
    return [o.strip() for o in raw.split(",") if o.strip()]


def supabase_settings() -> tuple[str | None, str | None]:
    """(url, service-role key) from env vars. Server-side only, never log them."""
    return os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
