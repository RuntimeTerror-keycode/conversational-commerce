from fastapi import APIRouter

from app.routers.deps import run_action
from app.schemas import TextRequest
from app.services.whatsapp import send_text


router = APIRouter(tags=["Messages"])


@router.post(
    "/text",
    summary="Send a WhatsApp text message",
)
def send_text_message(body: TextRequest):

    result = run_action(
        lambda: send_text(body.destination, body.text)
    )

    return {
        "destination": body.destination,
        "text": body.text,
        "result": result
    }
