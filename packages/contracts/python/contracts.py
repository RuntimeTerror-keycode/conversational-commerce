"""Pydantic mirror of packages/contracts/src/index.ts.
Both sides parse packages/contracts/fixtures/*.json in their tests.
If you change one side and not the other, those tests go red."""
from typing import Literal, Optional, Union
from pydantic import BaseModel, Field

class TextBlock(BaseModel):
    type: Literal["text"]
    body: str = Field(max_length=1024)

class Button(BaseModel):
    id: str
    label: str = Field(max_length=20)

class ButtonsBlock(BaseModel):
    type: Literal["buttons"]
    body: str = Field(max_length=1024)
    buttons: list[Button] = Field(max_length=3)

class ListRow(BaseModel):
    id: str
    title: str = Field(max_length=24)
    description: Optional[str] = None

class ListBlock(BaseModel):
    type: Literal["list"]
    body: str = Field(max_length=1024)
    header: Optional[str] = None
    rows: list[ListRow] = Field(max_length=10)

class CartLine(BaseModel):
    lineId: str
    productName: str
    sourceText: Optional[str] = None
    quantity: float
    unit: str
    price: float

class CartSummaryBlock(BaseModel):
    type: Literal["cart_summary"]
    items: list[CartLine]
    total: float
    currency: Literal["INR"]

ReplyBlock = Union[TextBlock, ButtonsBlock, ListBlock, CartSummaryBlock]

class AgentTurnRequest(BaseModel):
    traceId: str
    messageId: str
    customerRef: str
    text: str
    source: Literal["text", "voice"]
    locale: Optional[str] = None

class AgentTurnResponse(BaseModel):
    traceId: str
    blocks: list[ReplyBlock] = Field(max_length=2)
    sessionState: Literal["active", "order_placed"]

class NotifyRequest(BaseModel):
    traceId: str
    customerRef: str
    blocks: list[ReplyBlock] = Field(max_length=2)
    reason: Literal["order_accepted", "order_rejected", "out_for_delivery", "delivered", "substitution"]


# ---------------------------------------------------------------------------
# WhatsApp order search/select — POST /api/whatsapp/orders/{search,select}
# Deliberate, temporary bypass of the agent (see root spec.md §14 item 13);
# apps/edge calls apps/api directly and renders the response synchronously.
# ---------------------------------------------------------------------------

class WhatsappAddress(BaseModel):
    addressLine: Optional[str] = None
    latitude: float
    longitude: float


class WhatsappSearchRequest(BaseModel):
    messageId: str
    customerRef: str
    text: str
    source: Literal["text", "voice"]
    timestamp: str
    address: WhatsappAddress
    paymentMode: Literal["COD", "GPAY"]


class WhatsappRow(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    price: str


class WhatsappFoundResponse(BaseModel):
    customerRef: str
    orderId: int
    tag: Literal["found"]
    rows: list[WhatsappRow]


class WhatsappChoiceResponse(BaseModel):
    customerRef: str
    orderId: int
    tag: Literal["choice"]
    body: str
    rows: list[WhatsappRow]


class WhatsappNotFoundResponse(BaseModel):
    customerRef: str
    orderId: int
    tag: Literal["not_found"]
    body: str


WhatsappSearchResponse = Union[WhatsappFoundResponse, WhatsappChoiceResponse, WhatsappNotFoundResponse]


class WhatsappSelectRequest(BaseModel):
    customerRef: str
    orderId: int
    productId: int


class WhatsappCartLine(BaseModel):
    lineId: str
    productName: str
    quantity: float
    unit: str
    price: float


class WhatsappCart(BaseModel):
    items: list[WhatsappCartLine]
    total: float
    currency: Literal["INR"]
    priceNote: Optional[str] = None


class WhatsappSubstitute(BaseModel):
    id: int
    name: str
    unit: str
    price: float


class WhatsappAddedResponse(BaseModel):
    customerRef: str
    orderId: int
    tag: Literal["added"]
    cart: WhatsappCart


class WhatsappUnavailableResponse(BaseModel):
    customerRef: str
    orderId: int
    tag: Literal["unavailable"]
    body: str
    substitutes: list[WhatsappSubstitute]


WhatsappSelectResponse = Union[WhatsappAddedResponse, WhatsappUnavailableResponse]
