import logging

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.config import VERIFY_TOKEN
from app.handlers import (
    handle_audio_message,
    handle_interactive_message,
    handle_location_message,
    handle_text_message,
    handle_unknown_message,
)

from .config import get_settings
from .security import verify_meta_signature

logger = logging.getLogger("edge.webhook")

router = APIRouter()


async def process_webhook(data: dict) -> None:
    try:
        value = data["entry"][0]["changes"][0]["value"]

        if "statuses" in value:
            status = value["statuses"][0]
            logger.info("Message status: %s", status.get("status"))
            return

        if "messages" not in value:
            logger.info("No messages in webhook event.")
            return

        message = value["messages"][0]
        sender = message["from"]
        message_type = message["type"]

        logger.info("Sender=%s type=%s", sender, message_type)

        if message_type == "text":
            await handle_text_message(message, sender)
        elif message_type == "audio":
            await handle_audio_message(message, sender)
        elif message_type == "location":
            handle_location_message(message, sender)
        elif message_type == "interactive":
            handle_interactive_message(message, sender)
        else:
            handle_unknown_message(message_type, sender)

    except (KeyError, IndexError, TypeError):
        logger.exception("Could not parse webhook payload: %s", data)
    except Exception:
        logger.exception("Error processing webhook")


@router.get("/webhook")
async def verify_webhook(request: Request) -> Response:
    settings = get_settings()
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    verify_token = settings.whatsapp_verify_token or VERIFY_TOKEN or ""

    if mode == "subscribe" and token == verify_token:
        return Response(content=challenge, status_code=200)
    return Response(status_code=403)


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks) -> Response:
    settings = get_settings()
    raw_body = await request.body()

    # Signature check is optional: only enforced when META_APP_SECRET is set.
    # VERIFY_TOKEN alone is enough for Meta's GET subscribe handshake.
    if settings.whatsapp_app_secret:
        signature = request.headers.get("X-Hub-Signature-256")
        if not verify_meta_signature(raw_body, signature, settings.whatsapp_app_secret):
            return Response(status_code=401)

    try:
        payload = await request.json()
    except Exception:
        return Response(content="Invalid JSON", status_code=400)

    if not payload:
        return Response(content="Invalid JSON", status_code=400)

    background_tasks.add_task(process_webhook, payload)
    return Response(content="OK", status_code=200)
