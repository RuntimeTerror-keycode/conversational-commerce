# What the agent needs from `packages/domain`

Seven functions. `apps/agent` already calls all of them through stubs in
`apps/agent/src/mastra/tools/`, so if these signatures hold, swapping stubs for
real implementations is mechanical on the AI side.

Signatures come from `docs/contracts.md` §C1, cross-checked against the eight
tool files already written against them.

## How this gets consumed

Not over HTTP. `apps/agent` imports `packages/domain` in-process, the same way
`apps/api` does — one domain layer, two entry points. The Mastra tools are
schema and routing only: no SQL, no business logic.

Every rule marked **must** below has to live inside the domain function. The
model sits on the other side of that boundary and will happily do the wrong
thing if the function lets it.

The full demo path runs on stubs today, so the AI side is **not blocked** — but
nothing it does is real until these land.

---

## Catalogue

### `searchProducts`

```ts
searchProducts(
  retailerId: string,
  query: string,
  opts?: { attributes?: Record<string, string>; limit?: number }
): Promise<Product[]>

type Product = {
  id: string; name: string; brand?: string;
  unit: string; price: number; inStock: boolean;
}
```

- `query` is raw customer phrasing, unedited — the agent passes `"2 kg ari und?"`
  straight through. It does not pre-translate or strip quantities.
- **Must handle Malayalam and Manglish terms.** The hand-seeded alias table
  matters more here than any embedding model: `ari`→rice, `chaya podi`→tea
  powder, `kadala`→chickpeas, `mulaku podi`→chilli powder, `thairu`→curd,
  `kozhi`→chicken. Not exhaustive — see open question 5.
- `limit` defaults to 3 if unset. The agent offers two or three options, never a
  whole shelf.
- An empty array is a normal result, not an error. The agent tells the customer
  the store does not stock it and offers to check something else.

### `checkAvailability`

```ts
checkAvailability(
  retailerId: string,
  productIds: string[]
): Promise<AvailabilityResult[]>

type AvailabilityResult = {
  productId: string;
  inStock: boolean;
  substitutes: { id: string; name: string; unit: string; price: number }[];
}
```

- **Must not return `inStock: true` for an unknown `productId`.** The stub has
  this bug today, and it is exactly how a hallucinated SKU reaches a customer as
  a confident "yes, available."
- Substitutes drive the entire out-of-stock conversation. An empty array means
  the agent says there is no alternative and asks whether to continue without it.
- Stock status must come from the same source as `searchProducts().inStock`. Two
  sources that can disagree will disagree on stage.

---

## Cart

### `getCart`

```ts
getCart(customerId: string, retailerId: string): Promise<Cart>

type Cart = { items: CartLine[]; total: number; currency: "INR" }

type CartLine = {
  lineId: string; productName: string;
  quantity: number; unit: string; price: number;
}
```

- The cart never lives in conversation context. The agent re-reads it rather
  than reconstructing it from memory, so this is called often — keep it cheap.

### `mutateCart`

```ts
mutateCart(
  customerId: string,
  retailerId: string,
  op: CartOp
): Promise<Cart>

type CartOp = {
  action: "add" | "remove" | "set";
  productId: string;
  quantity: number;
  unit: string;
}
```

- **Must return the complete cart, never a diff.** The agent needs full state
  every time or it drifts on partial information.
- **Must reject an unknown `productId`** with an error rather than creating a
  line from it. The stub currently invents a line named after the id at ₹0,
  which silently corrupts the total — please do not reproduce that.
- **Must reject `quantity <= 0`** on `add` and `set`. Removal is
  `action: "remove"`, not a zero quantity.
- **Must reject adding an out-of-stock product**, or return the line flagged.
  The agent should never be able to build a cart it cannot order.

---

## Orders

Order placement is gated in code, not in the prompt. The model does not get a
vote, no matter how clearly the customer seems to have agreed.

### `requestOrderConfirmation`

```ts
requestOrderConfirmation(
  retailerId: string,
  customerId: string
): Promise<{
  summary: CartLine[];
  total: number;
  confirmationToken: string;
  expiresAt: string;      // ISO 8601
}>
```

- TTL is five minutes, per `docs/spec.md` §3.
- **Must bind the token to `(retailerId, customerId)`.** The stub does not,
  which means a token issued to one customer is spendable by another — fine in a
  fake in-memory map, a real problem against a real orders table.
- **Must be single use.** Consuming it invalidates it.
- Re-read prices live when building the summary. This is the moment the customer
  commits to a number, so it should be the freshest read in the conversation.

### `createOrder`

```ts
createOrder(
  confirmationToken: string,
  opts?: { deliveryNote?: string }
): Promise<
  | { orderId: string; status: "placed"; etaMinutes: number }
  | { error: true; reason: "not_found" | "expired" | "cart_changed" }
>
```

- **Must reject without a valid token, always.** This is the one rule the AI
  side will not let the model negotiate.
- **Must place the cart snapshot captured at confirmation**, not the live cart.
  If the live cart has diverged since, return `cart_changed` and the agent will
  re-confirm with the customer rather than shipping something they did not agree
  to.
- Return failures as values, not thrown exceptions. The agent has to explain
  them to a customer in their own language, so it needs to distinguish
  `expired` from `not_found`.

### `resolveRetailer`

```ts
resolveRetailer(customerRef: string): Promise<{
  retailerId: string; name: string; area: string;
}>
```

- Called once per turn before the agent runs. Not model-facing — the model never
  picks a retailer.
- `name` and `area` are interpolated into the system prompt ("You are a shopping
  assistant for Demo Store, a local store in Kochi"), so they should read
  naturally in a sentence.

### `transitionOrder`

```ts
transitionOrder(orderId: string, to: OrderStatus): Promise<Order>
```

Listed for completeness — the agent never calls this, the dashboard does. Noted
here because it is the function that emits `POST /notify`, which is open
question 4.

---

## Invariants — true of every function above

1. **`retailerId` is the first argument**, and scoping is enforced inside the
   function, not by the caller. The agent passes it from request context; the
   model never supplies it and never sees it.
2. **Errors are values wherever the customer will hear about them.** The agent
   turns a failure into a sentence in Malayalam or Manglish, so it needs a
   reason code, not a stack trace.
3. **Assume an adversarial caller.** Every argument that reaches these functions
   originated in a language model's output — non-existent ids, negative
   quantities, mismatched units. Validate all of it inside the function.

---

## Open questions

### 1. Is `lineId` distinct from `productId`?

The stub uses the product id as the line id, which breaks the moment the same
product appears twice in a cart at different pack sizes.

**Needed:** confirm `lineId` is generated per line, and say whether `mutateCart`
addresses lines by `productId` or by `lineId` for `remove` and `set`.

### 2. Does `traceId` reach domain functions?

`CLAUDE.md` says `traceId` threads through everything and is logged as a
structured field on every tool call *and* every domain function. Today it is
logged at the turn boundary but not passed inward, so a slow query cannot be tied
back to a conversation.

**Proposal:** a final `opts.traceId` on each function, or an ambient context the
domain layer reads. Backend's call — name one and the agent will pass it.

### 3. Who owns `POST /notify`?

`docs/contracts.md` §A2 assigns it to the AI service, but that predates
`apps/api` owning order mutation. Since accept and reject happen in the dashboard
routes and `transitionOrder` is where the status actually changes, the notify
call belongs with `apps/api`.

**Position:** `apps/api` owns it, called from inside `transitionOrder`. The AI
service has no model call in that path and no reason to be a hop in it. If
agreed, §A2 and §E need updating.

### 4. Where does the alias table live?

`CLAUDE.md` puts it at `packages/domain/src/catalog/aliases.ts`, which makes it
backend's to host. The content is a language problem more than a data problem,
and it is the single biggest lever on whether Manglish search feels magic or
broken.

**Offer:** backend owns the file, the AI side seeds and extends the entries —
they are testing against these terms daily and will find the gaps first.

---

## Suggested build order

| Order | Function | Unblocks |
|---|---|---|
| First | `searchProducts` | Real catalogue in the demo. Biggest visible difference; everything else can stay stubbed behind it. |
| Then | `getCart` + `mutateCart` | Cart survives a restart, and the dashboard reads the same rows the agent writes. |
| Then | `requestOrderConfirmation` + `createOrder` | Orders become real rows the dashboard can accept or reject — the full loop. |
| Last | `checkAvailability`, `resolveRetailer` | Both have serviceable stubs. Fine to land late. |

Each is independently swappable — the AI side does not need the set. Ship
`searchProducts` alone and it gets wired the same day.

---

## Changelog

| Date | What changed | Why |
|---|---|---|
| 2026-09-16 | **`sourceText` removed from `CartLine` and `CartOp`.** Open question 1 (who populates sourceText) dropped. | Backend decision: `sourceText` is not part of the domain contract. If needed later, it can be re-added as a separate concern. |
