# Interface contracts

Three interfaces to agree on before anyone writes code against them. Freeze these first; everything else can change.

---

## A. Edge ↔ AI service

Two endpoints, one in each direction. Both authenticated with a shared secret in `X-Service-Token`.

### A1. `POST /agent/turn` — edge calls AI service

```jsonc
// Request
{
  "traceId": "trc_01H...",        // generated at edge, echoed in all logs
  "messageId": "wamid...",        // Meta's id — used as idempotency key
  "customerRef": "91XXXXXXXXXX",  // wa_id, opaque to us
  "text": "2 kg ari und?",        // final text, post-transcription
  "source": "text" | "voice",
  "locale": "ml-IN" | "en-IN" | "mixed" | null,
  "sessionHint": null             // reserved
}
```

```jsonc
// Response 200
{
  "traceId": "trc_01H...",
  "blocks": [ /* ReplyBlock[] — see section D */ ],
  "sessionState": "active" | "order_placed"
}
```

**Behaviour the edge must implement:**
- Return 200 to Meta **before** calling this endpoint. This call happens in a background task.
- Debounce per `customerRef` for ~1.5s and coalesce rapid messages into one `text`.
- Deduplicate on `messageId` — Meta retries, and a duplicate must not double the cart.
- Timeout at 20s. On timeout or 5xx, send the customer a plain "one moment, having trouble" message. Never fail silently.
- `locale` is a hint only; the agent detects language itself.

**Behaviour the AI service guarantees:**
- Idempotent on `messageId` for 10 minutes.
- Returns within 20s or 504.
- Never returns more than 2 blocks.

### A2. `POST /notify` — AI service calls edge

Fires on order status changes. This is how the retailer's action reaches the customer.

```jsonc
{
  "traceId": "trc_01H...",
  "customerRef": "91XXXXXXXXXX",
  "blocks": [ /* ReplyBlock[] */ ],
  "reason": "order_accepted" | "order_rejected" | "out_for_delivery" | "substitution"
}
```

Response `202` is enough. Edge sends via Meta's Send Message API.

**This endpoint can message any customer — keep the shared secret out of the frontend and out of git.**

### A3. `GET /health` on both sides

Returns 200 with `{ "ok": true, "service": "edge" | "ai" }`. Needed so you can tell which side is down at 2am.

---

## B. What we need from the WhatsApp dev

1. **Confirm the 24-hour window constraint.** Outbound messages outside a 24h customer-initiated window need an approved template. Order status notifications may land outside it. Either submit a template early or accept that notifications only work for active conversations — but decide now, template approval is not instant.
2. **Voice note handling.** Confirm media download works with your token and tell us the realistic STT latency. If it exceeds ~4s we will send a "listening..." acknowledgement first.
3. **Interactive message support.** Confirm the edge can render buttons and list messages, not just text. Our reply blocks assume both.
4. **Test number and access.** Everyone needs to send messages to it, not just you.
5. **A `customerRef` that is stable.** If it changes format, our memory scoping breaks silently.

---

## C. What we need from the backend / dashboard

### C1. Domain functions the agent tools call

These live in `src/domain/` and are shared with the dashboard routes. Signatures we depend on:

```ts
searchProducts(retailerId: string, query: string, opts?): Promise<Product[]>
checkAvailability(retailerId: string, productIds: string[]): Promise<AvailabilityResult[]>
getCart(customerId: string, retailerId: string): Promise<Cart>
mutateCart(customerId: string, retailerId: string, op: CartOp): Promise<Cart>  // returns FULL cart
createOrder(cartId: string, opts): Promise<Order>
transitionOrder(orderId: string, to: OrderStatus): Promise<Order>  // emits notify
resolveRetailer(customerRef: string): Promise<{ retailerId: string; name: string; area: string }>
```

**`retailerId` is the first argument everywhere.** Scoping must be enforced inside these functions, not by the caller.

**`mutateCart` returns the complete cart**, not a diff. The agent needs full state to stay grounded.

### C2. Dashboard REST for the frontend

```
GET   /api/orders?status=&since=        → Order[]     (poll every 3s)
GET   /api/orders/:id                   → Order
PATCH /api/orders/:id  { status }       → Order       (accept / reject)
PATCH /api/orders/:id/items/:lineId     → Order       (substitute / adjust qty)
GET   /api/inventory?q=                 → Product[]
PATCH /api/inventory/:id  { inStock, price } → Product
```

Order status enum, shared verbatim with FE:
`draft | placed | accepted | rejected | packed | out_for_delivery | delivered`

### C3. What we need the FE dev to agree to

1. **Poll, do not use websockets.** `GET /api/orders?since=` every 3 seconds. Conference wifi kills socket connections and you will not notice until you are on stage.
2. **Accept and reject must be one click each,** no confirmation modal. The demo is a live loop — every extra click is dead air.
3. **Show the customer's original phrasing on the order line.** "2 kg ari" next to "Rice 2kg" is the single best proof the AI did something. Backend will include `sourceText` on each line item.
4. **Do not build inventory editing until orders work.** It is the more impressive screen and the less important one.
5. **Order list sorted newest first, with a visible unaccepted count.** That badge is what judges look at.

---

## D. Shared type: ReplyBlock

Owned by the AI service at `src/reply/types.ts`. The edge imports or mirrors it. Changes require agreement from both sides.

```ts
type ReplyBlock =
  | { type: 'text'; body: string }
  | { type: 'buttons'; body: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; body: string; header?: string;
      rows: { id: string; title: string; description?: string }[] }
  | { type: 'cart_summary'; items: CartLine[]; total: number; currency: 'INR' }

type CartLine = {
  lineId: string
  productName: string
  sourceText?: string      // what the customer actually said
  quantity: number
  unit: string
  price: number
}
```

Constraints the AI service enforces before returning (do not rely on prompting):
- `buttons`: max 3, `label` ≤ 20 chars
- `list`: max 10 rows, `title` ≤ 24 chars
- `body`: ≤ 1024 chars
- max 2 blocks per response

---

## E. Agree today, in this order

1. `POST /agent/turn` request and response shape — unblocks edge and AI in parallel
2. `ReplyBlock` union — unblocks the edge's renderer
3. Order status enum — unblocks the FE
4. `POST /notify` — unblocks the demo's best moment

Everything else can be negotiated while building. These four cannot.

Both sides should stub the other immediately: the edge hardcodes a `blocks` response so WhatsApp plumbing can be tested without a working agent, and the AI service tests via curl without WhatsApp. That parallelism is worth more than any other decision on this list.
