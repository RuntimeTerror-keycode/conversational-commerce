from app.services.whatsapp import (
    _message_id_from_response,
    send_whatsapp_list,
    send_whatsapp_poll,
)


def _format_price(price: float) -> str:
    if price == int(price):
        return f"₹{int(price)}"
    return f"₹{price:.2f}"


def _product_row(product: dict) -> dict:
    name = (product.get("name") or "").strip()
    description = (product.get("description") or "").strip()
    price_text = _format_price(float(product["price"]))

    if description:
        line = f"{description} · {price_text}"
    else:
        line = price_text

    return {
        "id": product["id"],
        "title": name,
        "description": line,
    }


def send_product_poll(
    destination: str,
    body: str,
    products: list[dict],
    header: str | None = None,
    footer: str | None = None,
    list_button_text: str = "Choose product",
) -> str | None:
    """
    Send one interactive message so the customer can pick a product.

    1 product  → list with a single row (Meta buttons need at least 2)
    2–3        → reply buttons
    4–10       → list message
    """
    if not products:
        raise ValueError("At least one product is required.")

    if len(products) > 10:
        raise ValueError("At most 10 products can be sent in one poll.")

    options = [_product_row(product) for product in products]

    if len(options) == 1:
        response_json = send_whatsapp_list(
            destination=destination,
            body=body,
            rows=options,
            button_text=list_button_text,
            header=header,
            footer=footer,
            section_title="Products",
        )
    else:
        response_json = send_whatsapp_poll(
            destination=destination,
            question=body,
            options=options,
            header=header,
            footer=footer,
            list_button_text=list_button_text,
        )

    return _message_id_from_response(response_json)
