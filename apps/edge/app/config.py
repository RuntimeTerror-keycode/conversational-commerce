import os

from dotenv import load_dotenv

load_dotenv()


def _first(*names: str, default: str | None = None) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


META_ACCESS_TOKEN = _first("META_ACCESS_TOKEN", "WHATSAPP_TOKEN")
META_PHONE_NUMBER_ID = _first("META_PHONE_NUMBER_ID", "WHATSAPP_PHONE_NUMBER_ID")
META_API_VERSION = os.getenv("META_API_VERSION", "v23.0")

VERIFY_TOKEN = _first("VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", default="")

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

NGROK_DOMAIN = os.getenv("NGROK_DOMAIN")

TEST_PHONE_NUMBER = os.getenv("TEST_PHONE_NUMBER") or "918618198675"
