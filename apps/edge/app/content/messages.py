# User-facing WhatsApp text messages.


def echo_text(text):

    return f"You sent:\n{text}"


AGENT_TROUBLE = "One moment, having trouble on our end. Please try again shortly."


def echo_transcript(transcript):

    return f"You said:\n{transcript}"


def voice_original_reply(original):

    return f"You said:\n{(original or '').strip()}"


AUDIO_NOT_UNDERSTOOD = (
    "Sorry, I couldn't understand the voice message."
)


def location_with_address(address, latitude, longitude):

    return (
        "Location received!\n\n"
        f"Address:\n{address}\n\n"
        f"Latitude: {latitude}\n"
        f"Longitude: {longitude}"
    )


def location_without_address(latitude, longitude):

    return (
        "Location received!\n"
        f"Latitude: {latitude}\n"
        f"Longitude: {longitude}"
    )


INTERACTIVE_THANKS = "Thanks — I got your response."


def poll_vote_thanks(option_title):

    return f"Thanks for voting!\nYou chose: {option_title}"


ORDER_CONFIRMED = "Order confirmed. Thank you!"
ORDER_CANCELLED = "Order cancelled."


def order_already_decided(status_text):

    return (
        f"This order was already {status_text}. "
        "Your previous choice cannot be changed."
    )


def order_summary(items, address):

    lines = ["Your order:\n"]
    total = 0.0

    for name, price in items:

        amount = float(price)
        total += amount
        lines.append(f"{name} — ₹{amount:.2f}")

    lines.append(f"\nTotal: ₹{total:.2f}\n")

    if address:

        lines.append(f"Delivery address:\n{address}")

    else:

        lines.append("No delivery address on this order yet.")

    return "\n".join(lines)


def address_set(address):

    return f"Delivery address set:\n{address}"


ASK_ADDRESS = (
    "Please send your delivery address, "
    "or share your location."
)

ASK_ADDRESS_WITH_SAVED = (
    "No address on this order yet.\n"
    "Tap a saved address, or choose New address."
)

ASK_NEW_ADDRESS = (
    "Send a new delivery address, "
    "or share your location."
)

ADDRESS_MISSING = "Please send a delivery address to continue."
ADDRESS_NOT_FOUND = "That saved address is no longer available."

ADDRESS_LIST_HEADER = "Delivery address"
ADDRESS_LIST_FOOTER = "Tap a saved address"
ADDRESS_LIST_BUTTON = "Choose address"
ADDRESS_LIST_SECTION = "Saved addresses"
ADDRESS_NEW_TITLE = "New address"
ADDRESS_NEW_DESCRIPTION = "Type it or share location"
ADDRESS_NEW_ID = "new_address"
ADDRESS_SAVED_ID_PREFIX = "saved_address:"


UNSUPPORTED_MESSAGE = (
    "Sorry, I currently support "
    "text, voice, location, and poll replies."
)


# Order confirmation poll copy

ORDER_CONFIRM_QUESTION = "Do you want to confirm the order?"
ORDER_CONFIRM_HEADER = "Order confirmation"
ORDER_CONFIRM_FOOTER = "You can choose only once"
ORDER_CONFIRM_YES = "Yes"
ORDER_CONFIRM_NO = "No"
ORDER_CONFIRM_YES_ID = "confirm_order_yes"
ORDER_CONFIRM_NO_ID = "confirm_order_no"
