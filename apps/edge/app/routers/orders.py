from fastapi import APIRouter, HTTPException

from app.routers.deps import run_action
from app.schemas import (
    AddressChoiceRequest,
    AddressSetRequest,
    CheckoutRequest,
)
from app.services.orders import (
    complete_checkout_with_address,
    get_checkout,
    handle_address_choice,
    start_checkout,
)


router = APIRouter(tags=["Orders"])


@router.post(
    "/orders",
    summary="Start checkout with dummy items and empty address",
)
def trigger_order(body: CheckoutRequest):

    entries = None

    if body.items:

        entries = [
            (item.name, item.price)
            for item in body.items
        ]
        entries.append(("address", body.address))

    checkout = run_action(
        lambda: start_checkout(
            destination=body.destination,
            entries=entries,
            address=body.address
        )
    )

    return {
        "destination": body.destination,
        "checkout": checkout
    }


@router.get(
    "/orders/{destination}",
    summary="Show the pending checkout for a customer",
)
def read_order(destination: str):

    checkout = get_checkout(destination)

    if not checkout:

        raise HTTPException(
            status_code=404,
            detail="No pending checkout for this number."
        )

    return {
        "destination": destination,
        "checkout": checkout
    }


@router.post(
    "/orders/address",
    summary="Set the delivery address on a pending checkout",
)
def trigger_set_address(body: AddressSetRequest):

    ok = run_action(
        lambda: complete_checkout_with_address(
            body.destination,
            body.address
        )
    )

    if not ok:

        if get_checkout(body.destination):

            raise HTTPException(
                status_code=400,
                detail="Please send a delivery address to continue."
            )

        raise HTTPException(
            status_code=404,
            detail="No pending checkout for this number."
        )

    return {
        "destination": body.destination,
        "checkout": get_checkout(body.destination)
    }


@router.post(
    "/orders/address/choice",
    summary="Tap a saved address (saved_address:0, saved_address:1, new_address)",
)
def trigger_address_choice(body: AddressChoiceRequest):

    handled = run_action(
        lambda: handle_address_choice(
            body.destination,
            body.option_id
        )
    )

    if not handled:

        raise HTTPException(
            status_code=400,
            detail="That is not a saved-address option, or there is no pending checkout."
        )

    return {
        "destination": body.destination,
        "option_id": body.option_id,
        "checkout": get_checkout(body.destination)
    }
