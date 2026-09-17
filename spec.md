# Conversational Commerce — Product Spec

WhatsApp-first grocery ordering for local retailers in Kerala. Customers text or
send voice notes in English, Malayalam, or Manglish (Malayalam in Latin script).
A Mastra agent understands the request, searches the retailer's catalogue, builds
a cart, and places an order behind a code-enforced confirmation gate. The
retailer fulfils from a web dashboard; status changes push WhatsApp messages
back to the customer.

This document is the product and system source of truth. Interface details live
in `docs/contracts.md` and `packages/contracts`. Coding-agent rules live in
`claude.md`. Shopping-agent behaviour lives in `agent.md`.

---

## 1. Product in one paragraph

A customer messages a shop's WhatsApp number ("2 kg ari und?"). The edge
service verifies Meta's webhook, acknowledges immediately, optionally
transcribes voice, and calls the agent. The agent searches the catalogue (with
a hand-seeded Malayalam/Manglish alias table), mutates a Postgres cart, and —
only after an explicit customer confirmation and a short-lived token — places
an order. The system auto-accepts. The order appears in the retailer dashboard
as work to pack and deliver. Accept / packed / out-for-delivery notifications
reach the customer on WhatsApp.

**Out of scope for the AI path:** Meta protocol, STT implementation details,
dashboard UI chrome, courier logistics, multi-retailer marketplace routing
beyond `resolveRetailer`.

---

## 2. Services

Four deploys (plus shared packages). Nothing shares a process across this table.

| Service | Path | Stack | Port | Owns |
|---|---|---|---|---|
| Edge | `apps/edge` | Python / FastAPI | 8000 | WhatsApp webhook, media download, STT, debounce, outbound send, `POST /notify` |
| Agent | `apps/agent` | TypeScript / Mastra | 4111 | `POST /agent/turn`, tools, conversation memory, reply blocks |
| API | `apps/api` | TypeScript / Express | 4000 | Dashboard REST under `/api` (orders, inventory, auth) |
| Dashboard | `apps/dashboard` | React / Vite | Vite default | Shopkeeper UI — talks **only** to `apps/api` |

| Package | Owns |
|---|---|
| `packages/contracts` | Shared Zod / Pydantic types (`AgentTurn*`, `ReplyBlock`, `NotifyRequest`, `OrderStatus`, `CartLine`) + JSON fixtures |
| `packages/domain` | Cart, orders, catalog, retailers — **one domain layer, two entry points** (`apps/agent` tools + `apps/api` routes). Not built yet; agent tools are stubs today |

`apps/agent` and `apps/api` never import each other's `src/`. Shared behaviour
goes in `packages/domain`.

Optional later: `apps/mcp` — MCP wrapper for Claude/Codex (scaffold only).

### Run locally

```
make install
cp .env.example .env
make db          # Postgres + pgvector via docker compose
make agent       # :4111
make api         # :4000
make edge        # :8000
make dashboard
```

---

## 3. Actors and journeys

### 3.1 Customer (WhatsApp)

1. Sends text or voice about products, quantities, substitutions, delivery notes.
2. Agent replies in the customer's language mix (short WhatsApp-style messages).
3. Customer confirms the cart summary; order is placed (`status: placed`).
4. System auto-accepts → customer gets an acceptance notification.
5. As the shop packs and dispatches, customer gets further WhatsApp updates.

### 3.2 Retailer (dashboard)

1. Leaves the dashboard open on a counter screen or phone.
2. Sees **already-accepted** orders as a fulfilment work queue (not an inbox).
3. Advances `accepted → packed → out_for_delivery → delivered` with one click each.
4. May adjust line quantities or substitute OOS items while the order is editable.
5. Between orders, manages inventory (full CRUD in **managed** mode; read-only
   mirror + sync in **external** mode).

**Product decision (2026-09-15):** there is **no accept/reject in the dashboard**.
Auto-accept is the only path into the UI. Older text in `docs/contracts.md` §C3
that requires one-click accept/reject and an "unaccepted count" is **superseded**.

### 3.3 Inventory modes (retailer record)

| Mode | Meaning | Stock behaviour |
|---|---|---|
| `managed` | Platform is the shop's inventory system | Shop edits products here; domain **decrements** stock on order lifecycle |
| `external` | Copy synced from the shop's own POS/billing | Catalogue mostly read-only; **do not** decrement — sync overwrites |

`inventoryMode` is read by the dashboard for UX. The **decision to decrement
lives only in `packages/domain`**, never in the client and never as a
request flag (so WhatsApp and dashboard paths cannot disagree).

---

## 4. Order lifecycle

Shared enum (`packages/contracts`):

```
draft → placed → accepted → packed → out_for_delivery → delivered
                ↘ rejected
```

| Status | Who sets it | Visible in dashboard? |
|---|---|---|
| `draft` | Cart under construction | No |
| `placed` | Agent via gated `createOrder` / `placeOrder` | No (pre–auto-accept window) |
| `accepted` | **System** (auto-accept) | **Yes — entry point** |
| `packed` | Shopkeeper | Yes |
| `out_for_delivery` | Shopkeeper | Yes |
| `delivered` | Shopkeeper | Yes (terminal success) |
| `rejected` | Nothing in current product | Defensive only — see open questions |

**Split of ownership:** system owns `placed → accepted`; shopkeeper owns
`accepted → … → delivered`. Dashboard `PATCH` never sends `accepted` or
`rejected`.

On `accepted`, `rejected` (if ever), `out_for_delivery`, and substitutions, the
owner of order mutation calls the edge `POST /notify` so the customer is
messaged. **Ownership of `/notify` is still open** between `apps/api` and
`apps/agent` — prefer `apps/api` inside `transitionOrder` once domain lands.

**Auto-accept timing:** older spec used ~60s as a *fallback* for a distracted
retailer. With no retailer decision left, recommend **immediate** auto-accept
so the dashboard is not a minute behind reality. Configurable
`autoAcceptSeconds` may remain for demos.

There is no `cancelled` / `returned` / `refunded` state in the shared enum today.

---

## 5. Agent design (summary)

Full behaviour, tools, and prompts: see **`agent.md`**.

- **shopping-agent** — full tool set (live today on `feat/mastra-shopping-agent`).
- **fast-agent** — cheap model for trivial turns — deferred.
- Tools are schema + routing only; business logic belongs in `packages/domain`.
- Today every tool is an in-memory **stub**; swapping stubs for domain imports is
  mechanical once domain signatures match the agent-domain contract.
- Cart never lives in LLM context — always `getCart` / `mutateCart`.
- Order placement requires a `confirmationToken` from `requestOrderConfirmation`
  (TTL 5 minutes). Token gate is code, not prompt.
- Grounding rule: every product, price, and stock claim must come from a tool
  result in the **current turn**.
- Reply shape: channel-agnostic `ReplyBlock[]` (max 2). Edge renders to Meta.
  Current agent returns a single `text` block (buttons / list / cart_summary
  generation not wired yet).

Memory scoping:

| Mastra | Value | Lifetime |
|---|---|---|
| `resourceId` | `customer:{customerId}` | Permanent preferences |
| `threadId` | `session:{sessionId}` | Until order placed or ~30 min idle |

Working memory may store language, delivery area, usual brands, standing
preferences — **never** prices, stock, SKUs ids, or cart totals.

---

## 6. Catalogue retrieval

Highest product risk. Hybrid search (target once domain exists):

1. pgvector cosine on name + description embeddings
2. Postgres `pg_trgm` for typos / transliteration
3. Exact lookup on hand-seeded **alias table** (mandatory)

Example aliases: `ari` → rice, `chaya podi` → tea powder, `kadala` → chickpeas,
`mulaku podi` → chilli powder, `thairu` → curd, `kozhi` → chicken.

If top score is below threshold, ask a clarifying question — never silent wrong
match. Agent offers two or three options, not a whole shelf (`limit` default 3).

---

## 7. Channel contracts (overview)

### 7.1 Edge ↔ Agent (`docs/contracts.md` §A, `packages/contracts`)

- `POST /agent/turn` — edge → agent. Shared secret `X-Service-Token`.
- `POST /notify` — order-mutation owner → edge → Meta Send Message API.
- Edge returns **200 to Meta before** calling the agent (background task).
- Debounce ~1.5s per `customerRef`; dedupe on `messageId`; 20s timeout.

`AgentTurnRequest`: `traceId`, `messageId`, `customerRef`, `text`, `source`
(`text`|`voice`), optional `locale`.  
`AgentTurnResponse`: `traceId`, `blocks` (≤2), `sessionState`
(`active`|`order_placed`).

### 7.2 WhatsApp ↔ Backend (attached WhatsApp contract)

Inbound customer order intent (edge / backend boundary used by the WhatsApp
integration branch):

```jsonc
{
  "messageId": "wamid.demo001",
  "customerRef": "919999999999",
  "text": "Is there 20 kilos rice available?",
  "source": "text",              // or "voice"
  "timestamp": "1700000000",
  "address": {
    "addressLine": "",
    "coords": { "lat": 10.0159, "long": 76.3419 }
  },
  "paymentMode": "COD"           // or "GPAY"
}
```

Outbound product presentation tags:

| Tag | Meaning |
|---|---|
| `found` | Matched products (`rows[]` with `id`, `title`, `price`) |
| `choice` | Ambiguous — customer must pick (`body` + `rows[]`) |

Customer selection callback: `{ customerRef, orderId, productId }`.

**Integration note:** the Mastra path speaks `ReplyBlock` (`text` / `buttons` /
`list` / `cart_summary`). The WhatsApp contract's `found` / `choice` tags are
the Meta-facing product-picker shape. Edge (or a thin adapter) must map between
them — do not teach the LLM to emit Meta JSON.

### 7.3 Domain functions (`packages/domain` — agent-domain contract)

Imported in-process by agent tools and API routes (not HTTP):

| Function | Role |
|---|---|
| `searchProducts` | Catalogue search; ML/Manglish aliases; default limit 3 |
| `checkAvailability` | Stock + substitutes; never `inStock: true` for unknown ids |
| `getCart` / `mutateCart` | Full cart always; reject unknown / OOS / `qty <= 0` on add/set |
| `requestOrderConfirmation` | Snapshot + single-use token bound to `(retailerId, customerId)`, TTL 5m |
| `createOrder` | Token-gated; place confirmation snapshot; value errors: `not_found` / `expired` / `cart_changed` |
| `resolveRetailer` | Once per turn from `customerRef` — model never picks retailer |
| `transitionOrder` | Dashboard / auto-accept path; emits notify |

Invariants: `retailerId` scoping inside the function; errors as values when the
customer will hear them; validate adversarial LLM outputs.

### 7.4 Dashboard REST (`apps/api` — frontend contract)

Base: `http://localhost:4000/api`. Poll orders every **3s** — **no websockets**.

Core surfaces (confirmed + proposed envelopes in the frontend contract):

- Auth (proposed): `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Orders: `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id` (fulfilment
  statuses only), `PATCH /orders/:id/items/:lineId`
- Inventory: `GET /inventory`, `PATCH /inventory/:id`, managed CRUD / sync as needed
- Stats / retailer settings (proposed)

Always show `sourceText` ("2 kg ari" beside "Rice 2kg") on order lines — best
demo proof the AI did something. Inventory editing ships **after** orders work.

Screens (proposed): `/login`, `/orders` (home), `/orders/:id`, `/inventory`,
`/settings`. Live Orders is a fulfilment queue with tabs New / In progress /
Completed / All. Badge counts **new accepted** work, not unaccepted decisions.

---

## 8. Reply blocks

```ts
type ReplyBlock =
  | { type: 'text'; body: string }
  | { type: 'buttons'; body: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; body: string; header?: string;
      rows: { id: string; title: string; description?: string }[] }
  | { type: 'cart_summary'; items: CartLine[]; total: number; currency: 'INR' }
```

Hard limits (enforce in code, not prompts): buttons ≤3, label ≤20 chars;
list ≤10 rows, title ≤24 chars; body ≤1024 chars; ≤2 blocks per turn.

---

## 9. Observability

`traceId` is generated at the edge and threaded through agent turn, tool calls,
domain functions, and notify. Log as a structured field.

Minimum per turn: `traceId`, `customerId`, agent name, tool call order, latency,
model tokens.

---

## 10. Evals (agent)

Scripted fixtures must cover:

- Manglish request → correct `searchProducts` hit
- OOS → substitutes from `checkAvailability`
- Mid-cart quantity change → `mutateCart` / `updateCart`
- Confirmation → `requestOrderConfirmation` then `placeOrder`
- **Grounding negative:** not-in-catalog → agent does not invent a product

---

## 11. Environment (root)

```
DATABASE_URL=postgresql://cc:cc@localhost:5432/cc
EDGE_NOTIFY_URL=http://localhost:8000/notify
AGENT_TURN_URL=http://localhost:4111/agent/turn
SERVICE_SHARED_SECRET=change-me
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
SARVAM_API_KEY=                 # STT (voice)
MODEL_PROVIDER=deepseek         # deepseek | anthropic | google
MODEL_MAIN=deepseek-flash
DEEPSEEK_API_KEY=               # or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
MASTRA_DB_URL=file:./mastra.db
PORT=4111
```

---

## 12. Build order

1. Domain layer + schema + seeded catalog with aliases
2. `searchProducts` + cart tools (swap stubs)
3. `POST /agent/turn` returning reply blocks (curl without WhatsApp)
4. Confirmation gate + `placeOrder` / `createOrder`
5. Dashboard REST + fulfilment transitions + **immediate auto-accept**
6. **Notify path back to WhatsApp** ← do not defer past here
7. fast-agent routing (latency)
8. MCP server
9. Voice polish

Steps 1–6 are a complete demo. Cut from the bottom if behind.

Suggested domain swap order: `searchProducts` → cart → confirmation/createOrder
→ `checkAvailability` / `resolveRetailer`.

---

## 13. Implementation status (as of branch inventory)

| Area | Status |
|---|---|
| `apps/edge` walking skeleton | Webhook verify, ack-then-agent, stub Meta send |
| `apps/edge` WhatsApp integration branch | Richer Meta helpers (lists, polls, location, audio/STT) — parallel tree under `app/` |
| `apps/agent` | Real Mastra shopping-agent; **all tools stubbed**; text-only replies |
| `apps/api` | Boilerplate (`feat/be-boiler-plate`) — health + class architecture; dashboard routes pending domain |
| `apps/dashboard` | Not started (`.gitkeep`); frontend contract is the build brief |
| `packages/domain` | Not built |
| Postgres / pgvector | `docker-compose` present; not wired into domain yet |

---

## 14. Open questions (blocking or high leverage)

Documented across the three attached contracts; summarised here:

1. ~~**`/notify` + auto-accept owner** — `apps/api` vs `apps/agent` (prefer API + `transitionOrder`).~~
   **Resolved and implemented (2026-09-17).** `apps/api` owns it. Fires on: order placement
   (`order_accepted` — fulfillments default to `accepted`, so this is the closest thing to an
   "accept" event), `PATCH /fulfillments/:id` transitioning to `out_for_delivery`, and
   `PATCH /fulfillments/:id/items/:lineId` substitutions. `rejected` is defined in
   `NotifyService`'s reason type but has no caller yet — `dashboardSettableStatuses` still
   excludes it (see item 3 below, unresolved). Notify failures are logged and swallowed —
   they never fail the underlying retailer action. See `apps/api/src/services/notify.service.ts`,
   `order-notify.service.ts`, `lib/edge-notify-client.ts`.
2. **Auto-accept delay** — keep ~60s or go immediate?
3. **Is `rejected` reachable?** Keep in enum defensively, or drop from UI?
4. **Shopkeeper auth** — nothing in repo; cookie session vs demo hardcoded retailer.
5. **Money units** — integer rupees vs paise; stubs use `320` as rupees.
6. **`sourceText` population** — add to `CartOp`; agent passes customer phrasing on add.
7. **`lineId` vs `productId`** for cart line identity / remove-set addressing.
8. **`traceId` into domain** — ambient context or `opts.traceId`.
9. **Managed `stockQuantity` + decrement transition** (`accepted` vs later).
10. **Alias table ownership** — file in domain; AI team seeds content.
11. **Payment / delivery vs pickup / cancellation** — barely specified; WhatsApp contract allows `COD` | `GPAY`.
12. **List envelope** for `GET /api/orders` (pagination + status `counts`) vs bare array in older §C2.
13. **Reconcile WhatsApp `found`/`choice` tags with `ReplyBlock`** in the edge adapter.
14. **WhatsApp search/select bypasses `apps/agent` for now (provisional answer to #13, 2026-09-17).**
    `apps/agent` isn't built yet (no mastra tools, `/agent/turn` doesn't compile), so
    `apps/edge` calls two new synchronous `apps/api` endpoints directly instead of going
    through step 2→3 of the build order above: `POST /api/whatsapp/orders/search` and
    `POST /api/whatsapp/orders/select` (see `apps/Whatsapp contract.md`), auth'd with the
    same `X-Service-Token`/`SERVICE_SHARED_SECRET` pattern as `/notify`. The response body
    *is* the `found`/`choice`/`not_found`/`added`/`unavailable` payload — no `/notify` round
    trip for this flow. The actual search/cart/session logic lives in `packages/domain`
    (`CatalogSearchService`, `CartService`, `SessionService`); `apps/api`'s
    `whatsapp.service.ts` is response-shaping only. When `apps/agent` is built, these same
    `packages/domain` calls should become Mastra tools, and the `found`/`choice` tags should
    be reconciled with `ReplyBlock` (item 13) in the edge adapter as originally planned —
    this isn't a replacement for that work, just what unblocks the demo today.

When these are decided, update this file and `docs/contracts.md` in the same PR.
