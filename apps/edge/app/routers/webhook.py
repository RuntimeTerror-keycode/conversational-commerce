from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Query, Request
from fastapi.responses import PlainTextResponse

from app.config import VERIFY_TOKEN
from app.handlers import (
    handle_audio_message,
    handle_interactive_message,
    handle_location_message,
    handle_text_message,
    handle_unknown_message,
)


router = APIRouter(include_in_schema=False)


@router.get("/webhook")
def verify_webhook(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(
        default=None,
        alias="hub.verify_token"
    ),
    hub_challenge: Optional[str] = Query(
        default=None,
        alias="hub.challenge"
    ),
):

    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:

        print("Webhook verified successfully.")

        return PlainTextResponse(
            content=hub_challenge or "",
            status_code=200
        )

    print("Webhook verification failed.")

    return PlainTextResponse(
        content="Verification failed",
        status_code=403
    )


@router.post("/webhook")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):

    try:

        data = await request.json()

    except Exception:

        return PlainTextResponse(
            content="Invalid JSON",
            status_code=400
        )

    if not data:

        return PlainTextResponse(
            content="Invalid JSON",
            status_code=400
        )

    background_tasks.add_task(process_webhook, data)

    return PlainTextResponse(
        content="OK",
        status_code=200
    )


def process_webhook(data):

    try:

        value = data["entry"][0]["changes"][0]["value"]

        if "statuses" in value:

            status = value["statuses"][0]

            print(
                "Message status:",
                status.get("status")
            )

            return

        if "messages" not in value:

            print("No messages in webhook event.")

            return

        message = value["messages"][0]

        sender = message["from"]
        message_type = message["type"]

        print("\n" + "=" * 50)
        print("Sender:", sender)
        print("Message type:", message_type)

        if message_type == "text":

            handle_text_message(
                message,
                sender
            )

        elif message_type == "audio":

            handle_audio_message(
                message,
                sender
            )

        elif message_type == "location":

            handle_location_message(
                message,
                sender
            )

        elif message_type == "interactive":

            handle_interactive_message(
                message,
                sender
            )

        else:

            handle_unknown_message(
                message_type,
                sender
            )

        print("=" * 50 + "\n")

    except (KeyError, IndexError, TypeError) as error:

        print("Could not parse webhook payload:")
        print(error)
        print(data)

    except Exception as error:

        print("Error processing webhook:")
        print(error)
