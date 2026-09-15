import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Request, Response

from .agent_client import call_agent_turn
from .config import get_settings
from .contracts import AgentTurnRequest, TextBlock
from .render import send_blocks
from .security import verify_meta_signature

logger = logging.getLogger("edge.webhook")

router = APIRouter()


def _extract_text_message(payload: dict) -> dict | None:
    """Pull the first text message out of a WhatsApp Cloud API webhook envelope.

    Returns None for envelopes with no message (status callbacks, etc).
    """
    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]
        message = value["messages"][0]
    except (KeyError, IndexError, TypeError):
        return None

    if message.get("type") != "text":
        return None

    return {
        "wa_id": message["from"],
        "message_id": message["id"],
        "text": message["text"]["body"],
    }


async def _process_turn(agent_request: AgentTurnRequest) -> None:
    settings = get_settings()
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
    message = _extract_text_message(payload)

    if message is None:
        # No text message in this envelope (status update, etc) — ack and move on.
        return Response(status_code=200)

    trace_id = f"trc_{uuid.uuid4().hex[:12]}"
    agent_request = AgentTurnRequest(
        traceId=trace_id,
        messageId=message["message_id"],
        customerRef=message["wa_id"],
        text=message["text"],
        source="text",
        locale=None,
    )

    background_tasks.add_task(_process_turn, agent_request)

    return Response(status_code=200)
