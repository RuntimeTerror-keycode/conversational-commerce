import uuid

from app.content import messages
from app.services.addresses import save_address
from app.services.audio import transcribe_audio, transcribe_audio_bytes
from app.services.confirmations import claim_order_confirmation
from app.services.location import get_address_from_coordinates
from app.services.orders import (
    clear_checkout,
    complete_checkout_with_address,
    handle_address_choice,
    is_awaiting_address,
)
from app.services.whatsapp import (
    send_text,
    send_whatsapp_list,
    send_whatsapp_poll,
    react_to_message,
)

from edge.agent_client import call_agent_turn
from edge.config import get_settings
from edge.contracts import AgentTurnRequest


def render_reply_blocks(sender, blocks):

    for block in blocks:

        if block.type == "text":
            send_text(destination=sender, text=block.body)

        elif block.type == "buttons":
            send_whatsapp_poll(
                destination=sender,
                question=block.body,
                options=[
                    {"id": button.id, "title": button.label}
                    for button in block.buttons
                ],
            )

        elif block.type == "list":
            send_whatsapp_list(
                destination=sender,
                body=block.body,
                rows=[
                    {"id": row.id, "title": row.title, "description": row.description}
                    for row in block.rows
                ],
                header=block.header,
            )

        elif block.type == "cart_summary":
            lines = "\n".join(
                f"- {item.productName} x{item.quantity} {item.unit} — ₹{item.price}"
                for item in block.items
            )
            send_text(
                destination=sender,
                text=f"{lines}\n\nTotal: ₹{block.total}",
            )


async def forward_to_agent(
    sender,
    text,
    message_id=None,
    source="text",
    locale=None,
    latitude=None,
    longitude=None,
):
    """Send one turn to apps/agent and render whatever it replies with.

    Shared by every message type (text, voice, location, interactive) so a
    customer's input is never silently swallowed by a static reply — it
    always reaches the real conversational agent. latitude/longitude are
    only ever set for a genuine WhatsApp location share — never guessed
    from text — so the agent can persist real coordinates deterministically.
    """

    settings = get_settings()
    request = AgentTurnRequest(
        traceId=str(uuid.uuid4()),
        messageId=message_id or str(uuid.uuid4()),
        customerRef=sender,
        text=text,
        source=source,
        locale=locale,
        latitude=latitude,
        longitude=longitude,
    )

    try:
        response = await call_agent_turn(request, settings)
    except Exception:
        send_text(destination=sender, text=messages.AGENT_TROUBLE)
        return {"action": "agent_error"}

    render_reply_blocks(sender, response.blocks)

    return {"action": "agent_turn", "sessionState": response.sessionState}


async def handle_text(sender, text, message_id=None):

    print("User message:", text)

    if is_awaiting_address(sender):

        complete_checkout_with_address(
            sender,
            (text or "").strip()
        )
        return {"action": "address"}

    return await forward_to_agent(sender, text, message_id=message_id, source="text")


async def handle_text_message(message, sender):

    return await handle_text(
        sender,
        message["text"]["body"],
        message.get("id"),
    )


async def handle_interactive(
    sender,
    option_id,
    option_title="",
    poll_message_id=None,
):

    print("Poll reply id:", option_id)
    print("Poll reply title:", option_title)
    print("Poll message id:", poll_message_id)

    if option_id in {
        messages.ORDER_CONFIRM_YES_ID,
        messages.ORDER_CONFIRM_NO_ID,
    }:

        return handle_order_confirmation_reply(
            sender=sender,
            option_id=option_id,
            poll_message_id=poll_message_id
        )

    if handle_address_choice(sender, option_id):
        return {"action": "address_choice"}

    # Not one of the legacy demo flows above — this is a tap on something the
    # agent itself sent (a buttons/list ReplyBlock). Treat it exactly like the
    # customer typed the option's label, so the conversation continues.
    return await forward_to_agent(
        sender,
        option_title or option_id,
        message_id=poll_message_id,
        source="text",
    )


async def handle_interactive_message(message, sender):

    interactive = message.get("interactive", {})
    interactive_type = interactive.get("type")

    if interactive_type == "button_reply":

        reply = interactive.get("button_reply", {})

    elif interactive_type == "list_reply":

        reply = interactive.get("list_reply", {})

    else:

        send_text(
            destination=sender,
            text=messages.INTERACTIVE_THANKS
        )

        return {"action": "thanks"}

    return await handle_interactive(
        sender=sender,
        option_id=reply.get("id", ""),
        option_title=reply.get("title", ""),
        poll_message_id=message.get("context", {}).get("id")
    )


def handle_order_confirmation_reply(sender, option_id, poll_message_id):

    status = (
        "confirmed"
        if option_id == messages.ORDER_CONFIRM_YES_ID
        else "cancelled"
    )

    accepted, current_status = claim_order_confirmation(
        message_id=poll_message_id,
        sender=sender,
        status=status
    )

    if not accepted:

        status_text = (
            "confirmed"
            if current_status == "confirmed"
            else "cancelled"
        )

        send_text(
            destination=sender,
            text=messages.order_already_decided(status_text)
        )

        return {
            "action": "already_decided",
            "status": current_status
        }

    if status == "confirmed":

        clear_checkout(sender)

        send_text(
            destination=sender,
            text=messages.ORDER_CONFIRMED
        )

        return {
            "action": "confirmed",
            "status": status
        }

    clear_checkout(sender)

    send_text(
        destination=sender,
        text=messages.ORDER_CANCELLED
    )

    return {
        "action": "cancelled",
        "status": status
    }


async def handle_audio(sender, media_id=None, message_id=None, audio_bytes=None, suffix=".ogg"):

    if message_id:

        react_to_message(
            destination=sender,
            message_id=message_id,
            emoji="👂"
        )

    if audio_bytes is not None:
        result = transcribe_audio_bytes(audio_bytes, suffix=suffix)
    else:
        result = transcribe_audio(media_id)

    if not result:

        send_text(
            destination=sender,
            text=messages.AUDIO_NOT_UNDERSTOOD
        )

        if message_id:
            react_to_message(destination=sender, message_id=message_id, emoji="✅")

        return {"action": "audio", "understood": False, "result": None}

    original = (result.get("original") or "").strip()
    english = (result.get("english") or "").strip()
    language_code = result.get("language_code")

    # Show what we heard — proof the STT worked, and lets the customer
    # correct course if the transcript is wrong.
    send_text(
        destination=sender,
        text=messages.voice_original_reply(original)
    )

    turn_result = await forward_to_agent(
        sender,
        english or original,
        message_id=message_id,
        source="voice",
        locale=language_code,
    )

    if message_id:
        react_to_message(destination=sender, message_id=message_id, emoji="✅")

    return {**turn_result, "result": result}


async def handle_audio_message(message, sender):

    return await handle_audio(
        sender=sender,
        media_id=message["audio"]["id"],
        message_id=message["id"]
    )


async def handle_location(
    sender,
    latitude,
    longitude,
    name=None,
    provided_address=None,
):

    print("Location received:")
    print("Latitude:", latitude)
    print("Longitude:", longitude)

    address = get_address_from_coordinates(
        latitude,
        longitude
    )

    if not address:
        address = provided_address or name

    print("Address:", address)

    if is_awaiting_address(sender):

        if address:

            complete_checkout_with_address(
                sender,
                address
            )

            return {
                "action": "checkout_address",
                "address": address,
                "latitude": latitude,
                "longitude": longitude
            }

        send_text(
            destination=sender,
            text=messages.ADDRESS_MISSING
        )

        return {
            "action": "address_missing",
            "latitude": latitude,
            "longitude": longitude
        }

    if not address:

        send_text(
            destination=sender,
            text=messages.location_without_address(
                latitude,
                longitude
            )
        )

        return {
            "action": "location",
            "address": None,
            "latitude": latitude,
            "longitude": longitude
        }

    save_address(sender, address)

    # Let the agent acknowledge the shared location in conversation, instead
    # of a static "Location received!" reply that goes nowhere. Real
    # coordinates ride along so the agent can persist them deterministically.
    turn_result = await forward_to_agent(
        sender,
        f"[Shared delivery location] {address}",
        source="text",
        latitude=latitude,
        longitude=longitude,
    )

    return {**turn_result, "address": address, "latitude": latitude, "longitude": longitude}


async def handle_location_message(message, sender):

    location = message["location"]

    return await handle_location(
        sender=sender,
        latitude=location["latitude"],
        longitude=location["longitude"],
        name=location.get("name"),
        provided_address=location.get("address")
    )


def handle_unknown_message(message_type, sender):

    print(
        "Unsupported message type:",
        message_type
    )

    send_text(
        destination=sender,
        text=messages.UNSUPPORTED_MESSAGE
    )

    return {"action": "unsupported"}
