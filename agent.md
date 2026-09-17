# Shopping agent — `apps/agent`

Guide for the Mastra conversational agent: what it owns, how tools work, how it
talks to `packages/domain`, and the behaviour rules that must not regress.

Companion docs: `spec.md` (product), `claude.md` (repo-wide architecture rules),
`docs/contracts.md` + `packages/contracts` (wire types), attached
**agent-domain contract** (domain function signatures).

---

## 1. What this service is

TypeScript + Mastra service that owns:

- `POST /agent/turn` — called only by `apps/edge` (shared secret)
- Conversation memory (thread + resource scoping, working memory)
- Tool schemas that call into `packages/domain` (stubs today)
- Channel-agnostic `ReplyBlock[]` responses

It does **not** own:

- WhatsApp / Meta payloads (edge renders)
- Dashboard REST (that is `apps/api`)
- SQL / stock / order business rules (that is `packages/domain`)
- STT (edge + Sarvam)

Port: **4111**. Health: `GET /health` → `{ ok: true, service: "ai" }`.

---

## 2. Product role

Customers in Kerala order groceries over WhatsApp in English, Malayalam, or
Manglish, often mixed. The agent:

1. Resolves the serving retailer (`resolveRetailer` — not model-facing).
2. Searches the retailer's catalogue with colloquial terms intact.
3. Builds a cart in the store system (Postgres via domain — stubs in memory now).
4. Confirms with the customer, then places an order only through a code gate.
5. Returns short reply blocks; edge sends them on WhatsApp.

After placement, **auto-accept and fulfilment notifications are not the agent's
job** — they belong with order mutation (`apps/api` / domain `transitionOrder`)
calling edge `POST /notify`. The agent tells the customer the order is with the
store and they will hear when it is accepted; it must not invent ETAs.

---

## 3. Layout

```
apps/agent/
├── src/
│   ├── api/
│   │   ├── agent-turn.ts      # POST /agent/turn
│   │   └── health.ts
│   ├── mastra/
│   │   ├── index.ts           # Mastra instance
│   │   ├── agents/
│   │   │   └── shopping-agent.ts
│   │   ├── tools/             # schema + stub/domain call ONLY
│   │   │   ├── search-products.ts
│   │   │   ├── check-availability.ts
│   │   │   ├── get-cart.ts
│   │   │   ├── update-cart.ts
│   │   │   ├── request-confirmation.ts
│   │   │   ├── place-order.ts
│   │   │   ├── resolve-retailer.ts
│   │   │   ├── fake-catalog.ts / cart-store / confirmation-store
│   │   │   └── index.ts
│   │   ├── memory/
│   │   │   ├── config.ts      # LibSQL + working-memory schema
│   │   │   └── session-store.ts
│   │   ├── prompts/
│   │   │   └── shopping-agent.md
│   │   ├── context.ts
│   │   └── models.ts          # MODEL_PROVIDER switch
│   ├── index.ts
│   └── server.ts
├── test/
├── .env.example
└── README.md
```

**Hard rule:** files under `src/mastra/tools/` contain zero business logic and
zero SQL. Each tool is Zod schema + a call into `packages/domain` (or a clearly
marked `// STUB` until domain lands).

---

## 4. Turn contract

### Request (`AgentTurnRequest`)

```jsonc
{
  "traceId": "trc_01H...",
  "messageId": "wamid...",       // idempotency key
  "customerRef": "91XXXXXXXXXX", // wa_id, opaque
  "text": "2 kg ari und?",       // final text, post-STT if voice
  "source": "text",              // or "voice"
  "locale": null                 // hint only; agent detects language
}
```

Note: older docs mention `sessionHint`; it is **not** in the current Zod schema
in `packages/contracts`. Do not depend on it until added to both TS and Python
mirrors.

### Response (`AgentTurnResponse`)

```jsonc
{
  "traceId": "trc_01H...",
  "blocks": [ { "type": "text", "body": "..." } ],
  "sessionState": "active"       // or "order_placed"
}
```

Guarantees: idempotent on `messageId` for ~10 minutes; respond within 20s or
504; **never more than 2 blocks**.

Auth: `X-Service-Token` must match `SERVICE_SHARED_SECRET`. Keep that secret
out of the frontend and out of git.

---

## 5. Agents

### shopping-agent (current)

Full tool set. System prompt: `src/mastra/prompts/shopping-agent.md`,
interpolated with retailer `name` and `area` from `resolveRetailer`.

### fast-agent (planned)

Cheap model; tools limited to cart read/write. Handles "yes", quantity tweaks,
greetings. Router: heuristics on text + whether a cart exists; when in doubt,
use shopping-agent. Deferred in build order (latency polish).

---

## 6. Tools ↔ domain

Tools receive `retailerId` and `customerId` from **run context**, never from the
model. Domain signatures (authoritative for BE) — agent already calls these
shapes via stubs:

### Catalogue

**`searchProducts(retailerId, query, opts?)` → `Product[]`**

- Pass customer phrasing **unedited** (`"2 kg ari und?"`).
- Must handle Malayalam / Manglish via alias table.
- `limit` defaults to **3**.
- Empty array is normal — tell the customer the store does not stock it.

**`checkAvailability(retailerId, productIds)` → `AvailabilityResult[]`**

- Must **not** return `inStock: true` for unknown ids (stub bug — do not keep).
- Substitutes drive the OOS conversation; empty substitutes → ask to continue without.
- Stock source must match `searchProducts`.

### Cart

**`getCart(customerId, retailerId)` → `Cart`**  
**`mutateCart(customerId, retailerId, op)` → `Cart`** (tool name today: `updateCart`)

- Always return the **complete** cart, never a diff.
- Reject unknown `productId`, `quantity <= 0` on add/set, and OOS adds.
- Prefer populating `sourceText` on add with the customer's exact words (demo
  proof on the dashboard).

### Orders

**`requestOrderConfirmation(retailerId, customerId)`**

- Returns summary, total, `confirmationToken`, `expiresAt` (TTL **5 minutes**).
- Token must bind to `(retailerId, customerId)`, single use.
- Re-read live prices when building the summary.

**`createOrder(confirmationToken, opts?)`** (tool name today: `placeOrder`)

- Reject without a valid token — **always**.
- Place the **confirmation snapshot**, not a diverged live cart → else
  `cart_changed`.
- Return failures as values: `not_found` | `expired` | `cart_changed`.

### Retailer

**`resolveRetailer(customerRef)`** — once per turn before the agent runs. Model
never picks a retailer. `name` / `area` go into the system prompt.

### Not agent-facing

**`transitionOrder`** — dashboard / auto-accept; emits `POST /notify`.

### Suggested stub → real swap order

1. `searchProducts`  
2. `getCart` + `mutateCart`  
3. `requestOrderConfirmation` + `createOrder`  
4. `checkAvailability`, `resolveRetailer`

---

## 7. Non-negotiable behaviour

Copied into the system prompt and enforced in evals / code:

1. **Grounding.** Only mention products, brands, prices, pack sizes, or stock
   that came from a tool result **in this turn**. Never invent substitutes.
2. **Cart in the store, not in chat.** Always `getCart` after mutations; do not
   reconstruct totals from memory.
3. **Confirmation gate.** `requestOrderConfirmation` → show summary → explicit
   customer yes → `placeOrder` with token. No token → tool rejects; model has no vote.
4. **Retailer scoping** inside domain functions.
5. **Language.** Mirror the customer's mix (Malayalam / English / Manglish /
   Latin-script Malayalam). Do not formalise or translate away their register.
6. **Brevity.** WhatsApp length: two or three lines; ask at most one question per
   message; no cheerleading ("Great choice!").
7. **Options.** Vague requests → offer two or three real options with brand /
   size / price, not the whole shelf.
8. **OOS.** `checkAvailability` before confirming; offer tool-returned
   substitutes only; never present a substitute as the original.
9. **Failures.** If a tool fails, say something went wrong — do not guess.

Working memory must **not** store catalogue facts (price, stock, SKU, totals) —
that silently defeats grounding. Allowed: language, delivery area, brand names
only, durable preferences.

---

## 8. Reply blocks

Edge renders these; the agent never builds Meta Graph JSON.

| Type | Use |
|---|---|
| `text` | Default (current production path) |
| `buttons` | ≤3, label ≤20 chars |
| `list` | ≤10 rows, title ≤24 chars — good for product choice |
| `cart_summary` | Lines + total INR |

Cap **2 blocks** per turn. Enforce limits in builders, not by prompting.

**Mapping to WhatsApp contract tags:** edge may present product pickers as
`tag: "found"` / `tag: "choice"` with `rows[]`. Prefer emitting `list` /
`buttons` from the agent and letting edge adapt — keep Meta-specific tags out
of the model.

---

## 9. Memory scoping

```ts
scopeFor(customerId, sessionId) → {
  resource: `customer:${customerId}`,  // forever
  thread:   `session:${sessionId}`,    // until order placed or ~30 min idle
}
```

Storage: LibSQL via `MASTRA_DB_URL` (default `file:./mastra.db`). Seed working
memory for at least one demo customer so "remembers you" works on stage.

---

## 10. Models

`src/mastra/models.ts` — env-driven provider switch:

| `MODEL_PROVIDER` | Example `MODEL_MAIN` | Key |
|---|---|---|
| `deepseek` (default) | `deepseek-flash` | `DEEPSEEK_API_KEY` |
| `anthropic` | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| `google` | `gemini-2.5-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Swapping providers is config, not a rewrite.

---

## 11. Local commands

```bash
cp apps/agent/.env.example apps/agent/.env
# set DEEPSEEK_API_KEY (or switch provider)

pnpm --filter agent dev
pnpm --filter agent test          # mocked, no network — CI safe
pnpm --filter agent typecheck

curl -s -X POST http://localhost:4111/agent/turn \
  -H "Content-Type: application/json" \
  -H "X-Service-Token: $SERVICE_SHARED_SECRET" \
  -d @packages/contracts/fixtures/agent-turn.json | jq
```

Expect `200`, one `text` block, `sessionState: "active"` (fixtures may omit the
auth header in early skeletons — keep token required in real deploys).

End-to-end with edge: point `AGENT_TURN_URL` at `:4111`, run `make edge` +
`make agent`, hit the webhook path (see root README on feature branches).

---

## 12. Status & known stub bugs (do not ship to production domain)

- All tools use in-memory fakes (`fake-catalog`, `cart-store`,
  `confirmation-store`).
- Stub `checkAvailability` can mark unknown ids in stock — **forbidden** in real domain.
- Stub `mutateCart` can invent a ₹0 line for unknown ids — **forbidden**.
- Stub confirmation tokens may not bind to `(retailerId, customerId)` — **must** in real domain.
- Reply blocks: text only; no `buttons` / `list` / `cart_summary` generation yet.
- No fast-agent / router yet.
- `packages/domain` not imported yet — swap is mechanical once signatures match.

---

## 13. Evals checklist

Before every demo, scripted turns must pass:

- [ ] Manglish query → correct search hit  
- [ ] OOS → substitute from tool, never invented  
- [ ] Quantity change → correct cart mutation  
- [ ] Confirm → token then place  
- [ ] Not-in-catalog → no hallucination (grounding negative)

---

## 14. Open questions that affect this service

From the agent-domain contract — track until closed:

1. Who writes `sourceText`? (Proposal: agent on every add via `CartOp`.)
2. Is `lineId` distinct from `productId` for remove/set?
3. How does `traceId` reach domain functions?
4. Who owns `POST /notify` after status change? (Prefer `apps/api`.)
5. Where does the alias table live, and who extends entries? (Domain file; AI seeds.)
