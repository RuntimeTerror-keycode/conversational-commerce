from fastapi import APIRouter

from app.handlers import handle_interactive, handle_order_confirmation_reply
from app.routers.deps import run_action
from app.schemas import (
    DestinationRequest,
    InteractiveRequest,
    PollReplyRequest,
)
from app.services.whatsapp import send_order_confirmation_poll


router = APIRouter(tags=["Polls"])


@router.post(
    "/polls/confirm",
    summary="Send the Yes/No order confirmation poll",
)
def trigger_poll(body: DestinationRequest):

    message_id = run_action(
        lambda: send_order_confirmation_poll(body.destination)
    )

    return {
        "destination": body.destination,
        "poll_message_id": message_id
    }


@router.post(
    "/polls/reply",
    summary="Reply Yes or No as if the customer tapped the poll",
)
def trigger_poll_reply(body: PollReplyRequest):

    result = run_action(
        lambda: handle_order_confirmation_reply(
            sender=body.destination,
            option_id=body.option_id,
            poll_message_id=body.poll_message_id
        )
    )

    return {
        "destination": body.destination,
        **result
    }


@router.post(
    "/interactive",
    summary="Send a button or list reply (poll or saved address)",
)
def trigger_interactive(body: InteractiveRequest):

    result = run_action(
        lambda: handle_interactive(
            sender=body.destination,
            option_id=body.option_id,
            option_title=body.option_title,
            poll_message_id=body.poll_message_id
        )
    )

    return {
        "destination": body.destination,
        **result
    }
