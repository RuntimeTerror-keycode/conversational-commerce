import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    agent_turn_url: str
    service_shared_secret: str
    whatsapp_verify_token: str
    whatsapp_app_secret: str
    whatsapp_token: str
    whatsapp_phone_number_id: str
    ngrok_domain: str


def get_settings() -> Settings:
    return Settings(
        agent_turn_url=os.environ.get("AGENT_TURN_URL", "http://localhost:4111/agent/turn"),
        service_shared_secret=os.environ.get("SERVICE_SHARED_SECRET", "change-me"),
        whatsapp_verify_token=os.environ.get("WHATSAPP_VERIFY_TOKEN")
        or os.environ.get("VERIFY_TOKEN", ""),
        whatsapp_app_secret=os.environ.get("WHATSAPP_APP_SECRET", ""),
        whatsapp_token=os.environ.get("WHATSAPP_TOKEN")
        or os.environ.get("META_ACCESS_TOKEN", ""),
        whatsapp_phone_number_id=os.environ.get("WHATSAPP_PHONE_NUMBER_ID")
        or os.environ.get("META_PHONE_NUMBER_ID", ""),
        ngrok_domain=os.environ.get("NGROK_DOMAIN", ""),
    )
