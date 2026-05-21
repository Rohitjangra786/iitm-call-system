"""Central configuration. Reads .env once and exposes typed settings."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _req(key: str) -> str:
    """Return a required env var or raise a clear error."""
    val = os.getenv(key)
    if not val or val.startswith("sk-ant-xxxx") or "xxxx" in val.lower():
        raise RuntimeError(
            f"Missing config: {key}. Copy .env.example to .env and fill it in."
        )
    return val


# --- Anthropic ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

# --- Twilio ---
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

# --- Server ---
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8000").rstrip("/")
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0")
SERVER_PORT = int(os.getenv("SERVER_PORT", "8000"))

# --- Voice ---
TTS_VOICE = os.getenv("TTS_VOICE", "Polly.Aditi")
SPEECH_LANGUAGE = os.getenv("SPEECH_LANGUAGE", "en-IN")
MAX_TURNS = int(os.getenv("MAX_TURNS", "12"))

# --- Paths ---
DB_PATH = BASE_DIR / "calls.db"
DATA_DIR = BASE_DIR / "data"


def require_anthropic() -> str:
    return _req("ANTHROPIC_API_KEY")


def require_twilio() -> tuple[str, str, str]:
    return _req("TWILIO_ACCOUNT_SID"), _req("TWILIO_AUTH_TOKEN"), _req("TWILIO_FROM_NUMBER")
