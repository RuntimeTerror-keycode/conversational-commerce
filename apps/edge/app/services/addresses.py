# In-memory store of past customer delivery addresses.
# Replace with a real DB later; dummy values are here for testing.

DUMMY_SAVED_ADDRESSES = [
    {
        "id": "home",
        "label": "Home",
        "text": "12 MG Road, Bengaluru 560001",
    },
    {
        "id": "work",
        "label": "Work",
        "text": "45 Park Street, Kolkata 700016",
    },
]


# phone number -> list of {id, label, text}
CUSTOMER_ADDRESSES = {}


def _copy_dummy_addresses():

    return [
        {
            "id": address["id"],
            "label": address["label"],
            "text": address["text"],
        }
        for address in DUMMY_SAVED_ADDRESSES
    ]


def get_past_addresses(customer_id):
    """
    Return saved addresses for this customer.

    New customers are seeded with dummy addresses so tap-to-select
    can be tested without a real database.
    """

    if customer_id not in CUSTOMER_ADDRESSES:

        CUSTOMER_ADDRESSES[customer_id] = _copy_dummy_addresses()

    return list(CUSTOMER_ADDRESSES[customer_id])


def save_address(customer_id, address_text, label="Saved"):

    address_text = (address_text or "").strip()

    if not address_text:
        return None

    addresses = CUSTOMER_ADDRESSES.setdefault(
        customer_id,
        _copy_dummy_addresses()
    )

    for existing in addresses:

        if existing["text"].casefold() == address_text.casefold():
            return existing

    saved = {
        "id": f"addr_{len(addresses) + 1}",
        "label": label,
        "text": address_text,
    }

    addresses.append(saved)

    print("Saved address for", customer_id, ":", address_text)

    return saved
