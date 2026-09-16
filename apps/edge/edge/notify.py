import logging

from fastapi import APIRouter, Request, Response

from .config import get_settings
from .contracts import NotifyRequest
from .render import send_blocks

logger = logging.getLogger("edge.notify")

router = APIRouter()


@router.post("/notify")
async def receive_notify(request: Request) -> Response:
    settings = get_settings()
    token = request.headers.get("X-Service-Token")

    if token != settings.service_shared_secret:
        return Response(status_code=401)

    payload = await request.json()
    body = NotifyRequest.model_validate(payload)

    logger.info(
        "notify_received traceId=%s customerRef=%s reason=%s",
        body.traceId,
        body.customerRef,
        body.reason,
    )
    send_blocks(body.customerRef, body.blocks, body.traceId)
    return Response(status_code=202)
