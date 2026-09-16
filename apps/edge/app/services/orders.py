# Checkout: product list + delivery address, then confirm.

from app.content import messages
from app.services.addresses import get_past_addresses, save_address
from app.services.whatsapp import (
    send_text,
    send_whatsapp_list,
    send_location_request,
    send_order_confirmation_poll,
)


# Dummy cart for testing. Last pair is the address entry (empty on purpose).
DUMMY_ORDER_ENTRIES = [
    ("Milk 1L", 45),
    ("White Bread", 35),
    ("Eggs (12 pcs)", 72),
    ("address", ""),
]


# phone number -> pending checkout
PENDING_CHECKOUTS = {}


def split_items_and_address(entries, address=None):
    """
    Read a list of key-value pairs (product -> price),
    with a final address entry.

    `address` overrides the list entry when passed explicitly.
    """

    items = []
    parsed_address = ""

    for entry in entries:

        if isinstance(entry, dict):

            if "address" in entry and "price" not in entry:

                parsed_address = entry.get("address") or ""
                continue

            name = entry.get("name") or entry.get("product")
            price = entry.get("price")

            if name is None or price is None:
                continue

            items.append((str(name), float(price)))
            continue

        if not isinstance(entry, (tuple, list)) or len(entry) < 2:
            continue

        key, value = entry[0], entry[1]

        if str(key).strip().lower() == "address":

            parsed_address = value or ""
            continue

        items.append((str(key), float(value)))

    if address is not None:
        parsed_address = address

    return items, (parsed_address or "").strip()


def is_awaiting_address(sender):

    checkout = PENDING_CHECKOUTS.get(sender)

    return bool(checkout and checkout.get("awaiting_address"))


def _request_new_address(destination, text):

    try:

        send_location_request(
            destination=destination,
            text=text
        )

    except Exception as error:

        print("Location request failed, sending text instead:", error)

        send_text(
            destination=destination,
            text=text
        )


def start_checkout(destination, entries=None, address=None):
    """
    Start checkout from a product price list plus an address.

    If the address is empty, ask for one. Saved customer addresses
    are sent as tappable options when the store has any.
    """

    entries = DUMMY_ORDER_ENTRIES if entries is None else entries

    items, delivery_address = split_items_and_address(
        entries,
        address=address
    )

    if not items:
        raise ValueError("Checkout needs at least one product.")

    PENDING_CHECKOUTS[destination] = {
        "items": items,
        "address": delivery_address,
        "awaiting_address": not bool(delivery_address),
        "address_options": {},
    }

    send_text(
        destination=destination,
        text=messages.order_summary(
            items,
            delivery_address
        )
    )

    if delivery_address:

        send_order_confirmation_poll(destination)

    else:

        _ask_for_address(destination)

    return get_checkout(destination)


def checkout_snapshot(checkout):

    if not checkout:
        return None

    return {
        "items": [
            {
                "name": name,
                "price": price
            }
            for name, price in checkout["items"]
        ],
        "address": checkout["address"],
        "awaiting_address": checkout["awaiting_address"],
        "address_options": checkout["address_options"],
    }


def get_checkout(destination):

    return checkout_snapshot(PENDING_CHECKOUTS.get(destination))


def _ask_for_address(destination):

    past_addresses = get_past_addresses(destination)

    checkout = PENDING_CHECKOUTS[destination]
    checkout["awaiting_address"] = True
    checkout["address_options"] = {}

    if not past_addresses:

        _request_new_address(
            destination,
            messages.ASK_ADDRESS
        )
        return

    rows = []

    for index, saved in enumerate(past_addresses[:9]):

        option_id = f"{messages.ADDRESS_SAVED_ID_PREFIX}{index}"

        checkout["address_options"][option_id] = saved["text"]

        rows.append({
            "id": option_id,
            "title": saved["label"],
            "description": saved["text"],
        })

    rows.append({
        "id": messages.ADDRESS_NEW_ID,
        "title": messages.ADDRESS_NEW_TITLE,
        "description": messages.ADDRESS_NEW_DESCRIPTION,
    })

    send_whatsapp_list(
        destination=destination,
        body=messages.ASK_ADDRESS_WITH_SAVED,
        rows=rows,
        button_text=messages.ADDRESS_LIST_BUTTON,
        header=messages.ADDRESS_LIST_HEADER,
        footer=messages.ADDRESS_LIST_FOOTER,
        section_title=messages.ADDRESS_LIST_SECTION
    )


def complete_checkout_with_address(destination, address):

    address_text = (address or "").strip()

    checkout = PENDING_CHECKOUTS.get(destination)

    if not checkout:

        print("No pending checkout for", destination)
        return False

    if not address_text:

        send_text(
            destination=destination,
            text=messages.ADDRESS_MISSING
        )
        return False

    checkout["address"] = address_text
    checkout["awaiting_address"] = False

    save_address(destination, address_text)

    send_text(
        destination=destination,
        text=messages.address_set(address_text)
    )

    send_order_confirmation_poll(destination)

    return True


def handle_address_choice(sender, option_id):

    if not is_address_choice(option_id):
        return False

    checkout = PENDING_CHECKOUTS.get(sender)

    if not checkout:
        return False

    if option_id == messages.ADDRESS_NEW_ID:

        checkout["awaiting_address"] = True

        _request_new_address(
            sender,
            messages.ASK_NEW_ADDRESS
        )
        return True

    address_text = checkout.get("address_options", {}).get(option_id)

    if not address_text:

        send_text(
            destination=sender,
            text=messages.ADDRESS_NOT_FOUND
        )
        return True

    complete_checkout_with_address(sender, address_text)

    return True


def is_address_choice(option_id):

    if option_id == messages.ADDRESS_NEW_ID:
        return True

    return str(option_id).startswith(messages.ADDRESS_SAVED_ID_PREFIX)


def clear_checkout(sender):

    PENDING_CHECKOUTS.pop(sender, None)
