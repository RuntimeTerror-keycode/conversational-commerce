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

#### Session — how the FE identifies itself

No passwords. The FE sends a `username`, the API resolves the shop.

```
POST  /api/session         { "username": "suresh" }
```
```jsonc
// Response 200
{
  "user": {
    "id": 1,
    "username": "suresh",
    "name": "Suresh Kumar",
    "role": "owner"
  },
  "shop": {
    "id": 1,
    "name": "Fresh Mart Kochi",
    "isActive": true
  }
}
```
```jsonc
// Response 401 — username not found or user inactive
{ "error": "unknown_user", "message": "No active user with that username" }
```

The FE stores the returned `shop.id` and passes it as the **`X-Shop-Id`** header on every subsequent request. The API validates this header on every route — if missing or invalid, return `400`.

#### All routes below require `X-Shop-Id` header

**Fulfillments** — the shop's slice of a customer order. The customer's full order (`master_order`) may span multiple shops; each shop sees only their fulfillment(s).

```
GET    /api/fulfillments?status=&since=          → Fulfillment[]   (poll every 3s)
GET    /api/fulfillments/:id                     → Fulfillment
PATCH  /api/fulfillments/:id      { status }     → Fulfillment     (advance status)
PATCH  /api/fulfillments/:id/items/:lineId       → Fulfillment     (substitute / adjust qty)
```

**Inventory**

```
GET    /api/inventory?q=                         → Product[]
PATCH  /api/inventory/:id  { inStock, price }    → Product
```

**Scoping rule:** every query filters by the `shopId` from the header. A shop can never see another shop's orders or inventory.

**Flow summary:**
1. Dashboard loads → user types username → `POST /api/session`
2. FE stores `shopId` from response
3. Every API call includes `X-Shop-Id: <shopId>` header
4. Backend validates header, scopes all queries to that shop

Fulfillment status enum (what the dashboard works with):
`accepted | packed | out_for_delivery | delivered | rejected`

The system auto-accepts every order. `draft` and `placed` exist only on `master_order` and are never visible to the dashboard. A fulfillment is born `accepted` — the shopkeeper advances it from there:

```
accepted → packed → out_for_delivery → delivered
```

`rejected` is kept in the enum defensively but nothing in the current product produces it.

**Status transitions the dashboard can make:**
| From | To | Button label |
|---|---|---|
| `accepted` | `packed` | Mark packed |
| `packed` | `out_for_delivery` | Out for delivery |
| `out_for_delivery` | `delivered` | Mark delivered |

`out_for_delivery` and `delivered` transitions emit `POST /notify` to the edge (§A2).

### C3. What we need the FE dev to agree to

1. **Poll, do not use websockets.** `GET /api/fulfillments?since=` every 3 seconds. Conference wifi kills socket connections and you will not notice until you are on stage.
2. **No accept or reject in the dashboard.** Orders are auto-accepted by the system. Fulfillments arrive already `accepted` — the shopkeeper's job starts at packing.
3. **Show the customer's original phrasing on the order line.** "2 kg ari" next to "Rice 2kg" is the single best proof the AI did something. Backend will include `sourceText` on each line item.
4. **Do not build inventory editing until orders work.** It is the more impressive screen and the less important one.
5. **Fulfillment list sorted newest first, with a visible new-order count badge.** That badge counts `accepted` fulfillments (work waiting). It is what judges look at.

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

---

## Changelog

| Date | What changed | Why |
|---|---|---|
| 2026-09-16 | **§C2: Session added.** `POST /api/session { username }` → user + shop. All routes require `X-Shop-Id` header. No passwords — hackathon-grade auth. | `shop_user` table with unique `username` added to DB. FE needs a way to identify which shop to scope to. |
| 2026-09-16 | **§C2: `/api/orders` → `/api/fulfillments`.** Dashboard shows the shop's fulfillment slice, not the customer's master order. | DB is multi-vendor: `master_order` (customer) → `fulfillment` (per-shop). Each shop only sees their fulfillments. |
| 2026-09-16 | **§C2: Fulfillment status enum replaces order status enum.** Dashboard works with `accepted \| packed \| out_for_delivery \| delivered \| rejected`. `draft` and `placed` are master_order-only, never visible. | Auto-accept means fulfillments are born `accepted`. |
| 2026-09-16 | **§C2: Status transition table added.** `accepted → packed → out_for_delivery → delivered`, with button labels. | Makes it unambiguous what the FE renders. |
| 2026-09-16 | **§C3 rule 2: Accept/reject removed.** Was "one click each" — now "No accept or reject in the dashboard." Auto-accept is the only path. | Product decision 2026-09-15: system auto-accepts, shopkeeper only does fulfilment. |
| 2026-09-16 | **§C3 rule 5: Badge changed.** Was "unaccepted count" — now counts `accepted` fulfillments (new work waiting). | Dashboard never sees unaccepted orders. |
| 2026-09-16 | **§C1: `customer.wa_id` → `customer.phone`** in DB. Same data, clearer name. | Aligns with `shop_user.phone` naming. |

### Responses to `docs/frontend-contract.md` proposals

The FE dev's analysis (`docs/frontend-contract.md`) proposed designs and raised questions tagged `Q-*`. Below is the BE position on each, based on what is now built.

**Auth (§7.1)**

| FE proposed | BE decision |
|---|---|
| `POST /api/auth/login { identifier, password }` + httpOnly cookie | **Replaced.** `POST /api/session { username }` — no password, no cookie. FE gets `shopId` and sends it as `X-Shop-Id` header. |
| `GET /api/auth/me` for session bootstrap | **Dropped.** FE just calls `/api/session` again on reload. |
| `POST /api/auth/logout` | **Dropped.** No session to clear. |
| `retailerId` derived server-side, never sent by FE | **Changed.** FE explicitly sends `X-Shop-Id` header. Simpler for hackathon — no cookie/CORS complexity. Server validates the header value exists and is active. |
| Q-A1 (cookie vs JWT) | **Neither.** Stateless header. |
| Q-A2 (login identity) | **Username**, not phone+password. |
| Q-A3 (session lifetime) | **N/A.** No session to expire. Dashboard stays alive indefinitely. |
| Q-A4 (auth at all for hackathon?) | **Minimal.** Username lookup only. No password, no token. |
| Q-A5 (roles) | `shop_user.role` is `'owner' \| 'staff'` in the DB. No permission gating for hackathon. |

**Orders → Fulfillments (§7.2)**

| FE proposed | BE decision |
|---|---|
| `/api/orders` routes | **Renamed to `/api/fulfillments`.** The dashboard shows the shop's slice, not the customer's master order. DB: `master_order` → `fulfillment` (per-shop). |
| Order status: `draft \| placed \| ... \| delivered` | **Fulfillment status: `accepted \| packed \| out_for_delivery \| delivered \| rejected`.** `draft` and `placed` are `master_order`-only. |
| FE never sends `accepted` or `rejected` (§2) | **Confirmed.** Auto-accept is the only path. PATCH only accepts `packed`, `out_for_delivery`, `delivered`. |
| Q-O1 (Order type exists?) | **No shared type yet.** The fulfillment response shape is TBD during implementation. FE's proposed `OrderSummary` / `Order` shapes in §7.2 are a reasonable starting point — rename `Order` → `Fulfillment`. |
| Q-O3 (cancellation) | **No `cancelled` state.** Not in scope for hackathon. |
| Q-O4 (delivery vs pickup) | **Both.** `master_order.delivery_type` is `'delivery' \| 'pickup'`. |
| Q-O5 (payment) | **COD only.** `master_order.payment_mode` defaults to `'cod'`. |
| Q-O6 (events audit trail) | **Yes.** `order_event` table exists in the DB — stores timestamped events with `actor` and `event_type`. |
| Q-O7 (polling: full page vs delta) | **Full page.** Agree with FE recommendation — delta-merge bugs on stage are not worth the savings. |
| Q-O8 (line edits in which status) | **`accepted` only.** Once packed, line items are frozen. |
| Q-O9 (update §C3/spec.md) | **Done.** §C3 updated in this file. |
| Q-O11 (auto-accept delay) | **Immediate.** No 60s wait. Fulfillment is born `accepted`. |
| Q-O12 (can rejected occur?) | **Defensively kept in enum.** Nothing produces it today. Render it if it appears, don't build UI to trigger it. |
| Q-O13 (who auto-accepts) | **`apps/api`** owns order placement and auto-accept. It calls `POST /notify` to the edge. |

**Inventory (§7.3)**

| FE proposed | BE decision |
|---|---|
| `stockQuantity` alongside boolean `inStock` | **Yes.** `shop_product` has both `stock_quantity` (integer) and `is_available` (boolean). |
| Q-I1 (when does decrement fire) | **At `accepted`** (= order time, since auto-accept is immediate). |
| Q-I2 (`inStock` auto-false at zero?) | **Yes.** Application logic sets `is_available = false` when `stock_quantity` hits 0. |
| Q-I3 (external mode editable?) | **Nothing editable.** Read-only mirror with sync. |
| Q-I4 (aliases editable?) | **Yes.** `tag` table exists. Shopkeeper can add search aliases. |
| Q-I5 (soft delete?) | **Soft archive.** Products in historical orders must still resolve. |
| Q-I6 (CSV import) | **Not for hackathon.** Seed data covers demo. |
| Q-I7 (categories/images) | **Categories yes** (`category` table). **Images no** — not in scope. |
| Q-I10 (low stock) | **Yes.** `shop_product.low_stock_threshold` exists, defaults to 5. |

**Response shapes (§7.0)**

| FE proposed | BE decision |
|---|---|
| List envelope `{ data, page, counts }` | **Accepted.** Bare arrays can't carry badge counts. |
| Error envelope `{ status, code, message, details }` | **Accepted.** Aligns with existing `ErrorHandler` shape. |
| 409 with `details.order` on conflict | **Accepted.** |
| Q-X1 (money: paise or rupees) | **Decimal rupees** — `DECIMAL(10,2)` in the DB. `320.00` = ₹320. |
| Q-X2 (list envelope) | **Yes** — see above. |
| Q-X3 (who owns `/notify`) | **`apps/api`** — it owns order mutation and status transitions. |
| Q-X5 (shared types in `packages/contracts`?) | **Yes.** Dashboard types go in `packages/contracts`. Python mirror only for types the edge needs. |
| Q-X6 (deploy origin) | **Localhost for hackathon.** CORS allows `http://localhost:*`. |

**Dashboard (§3)**

| FE proposed | BE decision |
|---|---|
| Q-D1 (separate home page?) | **No.** Orders-is-home + KPI strip. Agree with FE. |
| Q-D2 (`GET /api/stats/summary`) | **Derive from counts blocks.** No separate stats endpoint for hackathon. |
| Q-D3 (KPI strip worth it?) | **Yes** — but only if orders are done first. |

**Customer data**

| FE proposed | BE decision |
|---|---|
| Q-C1 (show full phone?) | **Yes.** Shopkeeper needs it for delivery. `customer.phone` is exposed. |
| Q-C2 (customer name?) | **Yes.** `customer.display_name` — nullable, populated from WhatsApp profile or first message. |
| Q-C3 (past orders?) | **Not for hackathon.** |

**Settings / UI — FE's call, not blocked on BE**

| Question | Position |
|---|---|
| Q-S1 (auto-accept configurable?) | Not for hackathon. Immediate, not configurable. |
| Q-S2 (shop open/closed toggle) | Not for hackathon. Crosses into agent behaviour. |
| Q-S3 (opening hours) | DB has `shop.opening_time` / `closing_time`. No enforcement yet. |
| Q-U1–U5 | FE's choice. No BE dependency. |
