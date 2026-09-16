import requests

from app.config import (
    META_ACCESS_TOKEN,
    META_PHONE_NUMBER_ID,
    META_API_VERSION,
)


def meta_headers():

    return {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}"
    }


def messages_url():

    return (
        f"https://graph.facebook.com/"
        f"{META_API_VERSION}/"
        f"{META_PHONE_NUMBER_ID}/messages"
    )


def send_text(destination, text):
    """
    Send a WhatsApp text message.

    This is the only outbound text sender. Order summaries,
    address prompts, confirmations, and POST /text all use it.
    """

    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    data = {
        "messaging_product": "whatsapp",
        "to": destination,
        "type": "text",
        "text": {
            "body": text
        }
    }

    response = requests.post(
        messages_url(),
        headers=headers,
        json=data,
        timeout=30
    )

    print("\nWhatsApp message response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()

    return response.json()


def _message_id_from_response(response_json):

    try:
        return response_json["messages"][0]["id"]
    except (KeyError, IndexError, TypeError):
        return None


def _normalize_poll_options(options):
    """
    Accept either plain strings or dicts with id/title.
    """

    cleaned_options = []

    for index, option in enumerate(options):

        if isinstance(option, dict):

            title = str(option.get("title", "")).strip()
            option_id = str(option.get("id", "")).strip()
            description = str(option.get("description", "")).strip()

            if not title:
                continue

            cleaned_options.append({
                "id": option_id or f"poll_option_{index}",
                "title": title,
                "description": description,
            })

            continue

        title = str(option).strip()

        if not title:
            continue

        cleaned_options.append({
            "id": f"poll_option_{index}",
            "title": title,
            "description": "",
        })

    return cleaned_options


def _list_row(option):

    row = {
        "id": option["id"][:200],
        "title": option["title"][:24],
    }

    description = option.get("description") or ""

    if description:
        row["description"] = description[:72]

    return row


def send_whatsapp_poll(
    destination,
    question,
    options,
    header=None,
    footer=None,
    list_button_text="Choose an option",
):
    """
    Send a poll-style interactive message.

    Meta Cloud API has no native polls, so this uses:
    - reply buttons when there are 2–3 options
    - a list message when there are 4–10 options
    """

    cleaned_options = _normalize_poll_options(options)

    if len(cleaned_options) < 2:
        raise ValueError("A poll needs at least 2 options.")

    if len(cleaned_options) > 10:
        raise ValueError("A poll can have at most 10 options.")

    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    interactive = {
        "body": {
            "text": question
        }
    }

    if header:
        interactive["header"] = {
            "type": "text",
            "text": header[:60]
        }

    if footer:
        interactive["footer"] = {
            "text": footer[:60]
        }

    if len(cleaned_options) <= 3:

        interactive["type"] = "button"
        interactive["action"] = {
            "buttons": [
                {
                    "type": "reply",
                    "reply": {
                        "id": option["id"][:256],
                        "title": option["title"][:20]
                    }
                }
                for option in cleaned_options
            ]
        }

    else:

        interactive["type"] = "list"
        interactive["action"] = {
            "button": list_button_text[:20],
            "sections": [
                {
                    "title": "Options",
                    "rows": [
                        _list_row(option)
                        for option in cleaned_options
                    ]
                }
            ]
        }

    data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": destination,
        "type": "interactive",
        "interactive": interactive
    }

    response = requests.post(
        messages_url(),
        headers=headers,
        json=data,
        timeout=30
    )

    print("\nWhatsApp poll response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()

    return response.json()


def send_whatsapp_list(
    destination,
    body,
    rows,
    button_text="Choose",
    header=None,
    footer=None,
    section_title="Options",
):
    """
    Send an interactive list message.

    Each row is a dict with id, title, and optional description.
    """

    cleaned_rows = []

    for index, row in enumerate(rows):

        if isinstance(row, dict):

            title = str(row.get("title", "")).strip()
            row_id = str(row.get("id", "")).strip()
            description = str(row.get("description", "")).strip()

        else:

            title = str(row).strip()
            row_id = ""
            description = ""

        if not title:
            continue

        entry = {
            "id": (row_id or f"list_option_{index}")[:200],
            "title": title[:24],
        }

        if description:
            entry["description"] = description[:72]

        cleaned_rows.append(entry)

    if not cleaned_rows:
        raise ValueError("A list needs at least 1 row.")

    if len(cleaned_rows) > 10:
        raise ValueError("A list can have at most 10 rows.")

    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    interactive = {
        "type": "list",
        "body": {
            "text": body
        },
        "action": {
            "button": button_text[:20],
            "sections": [
                {
                    "title": section_title[:24],
                    "rows": cleaned_rows
                }
            ]
        }
    }

    if header:
        interactive["header"] = {
            "type": "text",
            "text": header[:60]
        }

    if footer:
        interactive["footer"] = {
            "text": footer[:60]
        }

    data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": destination,
        "type": "interactive",
        "interactive": interactive
    }

    response = requests.post(
        messages_url(),
        headers=headers,
        json=data,
        timeout=30
    )

    print("\nWhatsApp list response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()

    return response.json()


def send_location_request(destination, text):

    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": destination,
        "type": "interactive",
        "interactive": {
            "type": "location_request_message",
            "body": {
                "text": text
            },
            "action": {
                "name": "send_location"
            }
        }
    }

    response = requests.post(
        messages_url(),
        headers=headers,
        json=data,
        timeout=30
    )

    print("\nWhatsApp location request response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()

    return response.json()


def send_order_confirmation_poll(destination):

    from app.content import messages
    from app.services.confirmations import register_order_confirmation

    response_json = send_whatsapp_poll(
        destination=destination,
        question=messages.ORDER_CONFIRM_QUESTION,
        options=[
            {
                "id": messages.ORDER_CONFIRM_YES_ID,
                "title": messages.ORDER_CONFIRM_YES
            },
            {
                "id": messages.ORDER_CONFIRM_NO_ID,
                "title": messages.ORDER_CONFIRM_NO
            },
        ],
        header=messages.ORDER_CONFIRM_HEADER,
        footer=messages.ORDER_CONFIRM_FOOTER
    )

    message_id = _message_id_from_response(response_json)
    register_order_confirmation(message_id, destination)

    return message_id


def react_to_message(destination, message_id, emoji):

    headers = {
        "Authorization": f"Bearer {META_ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    data = {
        "messaging_product": "whatsapp",
        "to": destination,
        "type": "reaction",
        "reaction": {
            "message_id": message_id,
            "emoji": emoji
        }
    }

    response = requests.post(
        messages_url(),
        headers=headers,
        json=data,
        timeout=30
    )

    print(f"\nWhatsApp reaction ({emoji}) response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()


def get_media_url(media_id):

    url = (
        f"https://graph.facebook.com/"
        f"{META_API_VERSION}/"
        f"{media_id}"
    )

    response = requests.get(
        url,
        headers=meta_headers(),
        timeout=30
    )

    print("\nMeta media info response:")
    print(response.status_code)
    print(response.text)

    response.raise_for_status()

    return response.json()["url"]


def download_media(media_url):

    response = requests.get(
        media_url,
        headers=meta_headers(),
        timeout=60
    )

    print("\nMeta media download response:")
    print(response.status_code)
    print("Downloaded bytes:", len(response.content))

    response.raise_for_status()

    return response.content