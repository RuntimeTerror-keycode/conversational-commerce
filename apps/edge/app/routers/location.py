from fastapi import APIRouter

from app.handlers import handle_location
from app.routers.deps import run_action, run_action_async
from app.schemas import DestinationRequest, LocationTriggerRequest
from app.services.whatsapp import send_location_request


router = APIRouter(tags=["Location"])


@router.post(
    "/location",
    summary="Send a location as if the customer shared it",
)
async def trigger_location(body: LocationTriggerRequest):

    result = await run_action_async(
        lambda: handle_location(
            sender=body.destination,
            latitude=body.latitude,
            longitude=body.longitude,
            name=body.name,
            provided_address=body.address
        )
    )

    return {
        "destination": body.destination,
        **result
    }


@router.post(
    "/location/request",
    summary="Ask the customer to share their location",
)
def trigger_location_request(body: DestinationRequest):

    run_action(
        lambda: send_location_request(
            destination=body.destination,
            text="Please share your delivery location."
        )
    )

    return {
        "destination": body.destination,
        "action": "location_request"
    }
