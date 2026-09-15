import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    agent_turn_url: str
    service_shared_secret: str
    whatsapp_verify_token: str
    whatsapp_app_secret: str


def get_settings() -> Settings:
    return Settings(
        agent_turn_url=os.environ.get("AGENT_TURN_URL", "http://localhost:4111/agent/turn"),
        service_shared_secret=os.environ.get("SERVICE_SHARED_SECRET", "change-me"),
        whatsapp_verify_token=os.environ.get("WHATSAPP_VERIFY_TOKEN", ""),
        whatsapp_app_secret=os.environ.get("WHATSAPP_APP_SECRET", ""),
    )
