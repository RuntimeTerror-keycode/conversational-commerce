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
    reason: Literal["order_accepted", "order_rejected", "out_for_delivery", "substitution"]
