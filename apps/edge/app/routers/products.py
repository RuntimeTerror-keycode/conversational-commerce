from fastapi import APIRouter

from app.routers.deps import run_action
from app.schemas import ProductPollRequest
from app.services.products import send_product_poll


router = APIRouter(tags=["Products"])


@router.post(
    "/products/poll",
    summary="Send a product choice poll (name, description, price per option)",
)
def trigger_product_poll(body: ProductPollRequest):
    products = [product.model_dump() for product in body.products]

    message_id = run_action(
        lambda: send_product_poll(
            destination=body.destination,
            body=body.body,
            products=products,
            header=body.header,
            footer=body.footer,
            list_button_text=body.list_button_text,
        )
    )

    tag = "found" if len(body.products) == 1 else "choice"

    return {
        "destination": body.destination,
        "tag": tag,
        "poll_message_id": message_id,
        "products": [
            {
                "id": product.id,
                "name": product.name,
                "description": product.description,
                "price": product.price,
            }
            for product in body.products
        ],
    }
