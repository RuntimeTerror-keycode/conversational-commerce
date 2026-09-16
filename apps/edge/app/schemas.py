from typing import List, Optional

from pydantic import BaseModel, Field

from app.config import TEST_PHONE_NUMBER
from app.content.messages import ORDER_CONFIRM_YES_ID


PHONE_EXAMPLE = TEST_PHONE_NUMBER or "918618198675"


def phone_field():

    return Field(
        default=TEST_PHONE_NUMBER or ...,
        min_length=8,
        description="WhatsApp number with country code, no +.",
        examples=[PHONE_EXAMPLE],
    )


class DestinationRequest(BaseModel):

    destination: str = phone_field()


class TextRequest(BaseModel):

    destination: str = phone_field()
    text: str = Field(
        examples=["hello"],
        description="WhatsApp text to send. Used for order summaries and every other text reply."
    )


class OrderItem(BaseModel):

    name: str = Field(examples=["Milk 1L"])
    price: float = Field(examples=[45])


class CheckoutRequest(BaseModel):

    destination: str = phone_field()
    items: Optional[List[OrderItem]] = Field(
        default=None,
        description="Leave empty to use the dummy cart."
    )
    address: str = Field(
        default="",
        description="Leave empty to ask for an address and show saved ones."
    )


class AddressSetRequest(BaseModel):

    destination: str = phone_field()
    address: str = Field(
        examples=["12 MG Road, Bengaluru 560001"]
    )


class AddressChoiceRequest(BaseModel):

    destination: str = phone_field()
    option_id: str = Field(
        examples=["saved_address:0"],
        description="saved_address:0, saved_address:1, or new_address"
    )


class SaveAddressRequest(BaseModel):

    destination: str = phone_field()
    address: str = Field(
        examples=["12 MG Road, Bengaluru 560001"]
    )
    label: str = Field(default="Saved", examples=["Home"])


class LocationTriggerRequest(BaseModel):

    destination: str = phone_field()
    latitude: float = Field(examples=[12.9716])
    longitude: float = Field(examples=[77.5946])
    name: Optional[str] = None
    address: Optional[str] = None


class PollReplyRequest(BaseModel):

    destination: str = phone_field()
    option_id: str = Field(
        default=ORDER_CONFIRM_YES_ID,
        examples=[ORDER_CONFIRM_YES_ID],
        description="confirm_order_yes or confirm_order_no"
    )
    poll_message_id: Optional[str] = Field(
        default=None,
        description="Message id returned by POST /polls/confirm"
    )


class InteractiveRequest(BaseModel):

    destination: str = phone_field()
    option_id: str = Field(examples=["saved_address:0"])
    option_title: str = ""
    poll_message_id: Optional[str] = None


class AudioMediaRequest(BaseModel):

    destination: str = phone_field()
    media_id: str
    message_id: Optional[str] = None
