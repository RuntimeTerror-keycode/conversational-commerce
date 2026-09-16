# Tracks order-confirmation polls so a second Yes/No tap is ignored.
# WhatsApp often keeps reply buttons tappable; we lock them server-side.

# message_id -> {"sender": str, "status": "pending"|"confirmed"|"cancelled"}
ORDER_CONFIRMATIONS = {}


def register_order_confirmation(message_id, sender):

    if not message_id:
        return

    ORDER_CONFIRMATIONS[message_id] = {
        "sender": sender,
        "status": "pending",
    }

    print("Registered order confirmation:", message_id)


def claim_order_confirmation(message_id, sender, status):
    """
    Accept only the first Yes/No for a poll message.

    Returns (accepted, current_status).
    """

    if not message_id:

        print("Missing poll message id; cannot lock confirmation.")
        return True, status

    existing = ORDER_CONFIRMATIONS.get(message_id)

    if existing and existing["status"] != "pending":

        print(
            "Ignored duplicate order confirmation:",
            message_id,
            "already",
            existing["status"]
        )

        return False, existing["status"]

    ORDER_CONFIRMATIONS[message_id] = {
        "sender": sender,
        "status": status,
    }

    print(
        "Locked order confirmation:",
        message_id,
        "->",
        status
    )

    return True, status
