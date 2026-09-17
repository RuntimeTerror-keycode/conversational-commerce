from fastapi import APIRouter

from app.routers.deps import run_action
from app.schemas import SaveAddressRequest
from app.services.addresses import get_past_addresses, save_address


router = APIRouter(tags=["Addresses"])


@router.get(
    "/addresses/{destination}",
    summary="List saved addresses for a customer",
)
def read_addresses(destination: str):

    return {
        "destination": destination,
        "addresses": get_past_addresses(destination)
    }


@router.post(
    "/addresses",
    summary="Save an address for a customer",
)
def trigger_save_address(body: SaveAddressRequest):

    saved = save_address(
        body.destination,
        body.address,
        label=body.label
    )

    return {
        "destination": body.destination,
        "saved": saved,
        "addresses": get_past_addresses(body.destination)
    }
