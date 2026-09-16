import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.services.audio import transcribe_audio
from app.services.location import get_address_from_coordinates

from .agent_client import call_agent_turn
from .config import get_settings
from .contracts import AgentTurnRequest, TextBlock
from .render import send_blocks
from .security import verify_meta_signature

logger = logging.getLogger("edge.webhook")

router = APIRouter()


def _webhook_value(payload: dict) -> dict | None:
    try:
        return payload["entry"][0]["changes"][0]["value"]
    except (KeyError, IndexError, TypeError):
        return None


def _extract_inbound(payload: dict) -> dict | None:
    """Pull the first customer message out of a WhatsApp Cloud API envelope.

    Returns None for envelopes with no message (status callbacks, etc).
    """
    value = _webhook_value(payload)
    if value is None or "messages" not in value:
        return None

    try:
        message = value["messages"][0]
    except (KeyError, IndexError, TypeError):
        return None

    inbound: dict = {
        "wa_id": message["from"],
        "message_id": message["id"],
        "type": message.get("type"),
    }

    message_type = inbound["type"]

    if message_type == "text":
        inbound["text"] = message["text"]["body"]
        inbound["source"] = "text"
        inbound["locale"] = None
        return inbound

    if message_type == "audio":
        inbound["media_id"] = message["audio"]["id"]
        inbound["source"] = "voice"
        return inbound

    if message_type == "interactive":
        interactive = message.get("interactive", {})
        interactive_type = interactive.get("type")
        if interactive_type == "button_reply":
            reply = interactive.get("button_reply", {})
        elif interactive_type == "list_reply":
            reply = interactive.get("list_reply", {})
        else:
            return None
        inbound["text"] = (reply.get("title") or reply.get("id") or "").strip()
        inbound["source"] = "text"
        inbound["locale"] = None
        if not inbound["text"]:
            return None
        return inbound

    if message_type == "location":
        location = message["location"]
        inbound["latitude"] = location["latitude"]
        inbound["longitude"] = location["longitude"]
        inbound["location_name"] = location.get("name")
        inbound["location_address"] = location.get("address")
        inbound["source"] = "text"
        inbound["locale"] = None
        return inbound

    return None


def _location_text(inbound: dict) -> str:
    address = inbound.get("location_address")
    if not address:
        try:
            address = get_address_from_coordinates(
                inbound["latitude"],
                inbound["longitude"],
            )
        except Exception:
            logger.exception(
                "reverse_geocode_failed messageId=%s",
                inbound["message_id"],
            )
            address = inbound.get("location_name")

    if address:
        return f"Delivery location: {address}"

    return (
        f"Delivery location: {inbound['latitude']}, {inbound['longitude']}"
    )


async def _process_turn(inbound: dict) -> None:
    settings = get_settings()
    source = inbound["source"]
    text = inbound.get("text")
    locale = inbound.get("locale")

    if inbound["type"] == "audio":
        try:
            result = transcribe_audio(inbound["media_id"])
        except Exception:
            logger.exception(
                "stt_failed messageId=%s",
                inbound["message_id"],
            )
            result = None

        if not result or not (result.get("original") or "").strip():
            fallback = TextBlock(
                type="text",
                body="Sorry, I couldn't understand the voice message.",
            )
            send_blocks(inbound["wa_id"], [fallback], f"trc_{uuid.uuid4().hex[:12]}")
            return

        text = (result.get("original") or "").strip()
        locale = result.get("language_code")

    if inbound["type"] == "location":
        text = _location_text(inbound)

    if not text:
        return

    trace_id = f"trc_{uuid.uuid4().hex[:12]}"
    agent_request = AgentTurnRequest(
        traceId=trace_id,
        messageId=inbound["message_id"],
        customerRef=inbound["wa_id"],
        text=text,
        source=source,
        locale=locale,
    )

    try:
        response = await call_agent_turn(agent_request, settings)
    except Exception:
        logger.exception("agent_turn_failed traceId=%s", agent_request.traceId)
        fallback = TextBlock(type="text", body="one moment, having trouble")
        send_blocks(agent_request.customerRef, [fallback], agent_request.traceId)
        return

    send_blocks(agent_request.customerRef, response.blocks, agent_request.traceId)


@router.get("/webhook")
async def verify_webhook(request: Request) -> Response:
    settings = get_settings()
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge", "")

    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        return Response(content=challenge, status_code=200)
    return Response(status_code=403)


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks) -> Response:
    settings = get_settings()
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256")

    if not verify_meta_signature(raw_body, signature, settings.whatsapp_app_secret):
        return Response(status_code=401)

    payload = await request.json()
    inbound = _extract_inbound(payload)

    if inbound is None:
        return Response(status_code=200)

    background_tasks.add_task(_process_turn, inbound)

    return Response(status_code=200)
