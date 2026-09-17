# AI service spec

Conversational shopping agent for WhatsApp. TypeScript, Mastra.

Owns: conversation state, intent understanding, catalog retrieval, cart construction, order confirmation.
Does not own: WhatsApp protocol, STT, retailer dashboard UI, delivery.

---

## 1. Scope boundary

The AI service is one of three deploys.

| Service | Language | Owns |
|---|---|---|
| Edge | Python / FastAPI | WhatsApp webhook, media download, STT, debounce, outbound send |
| AI + backend | TypeScript / Mastra | Agent, tools, domain services, dashboard REST |
| Dashboard | React | Retailer order and inventory UI |

The AI service never constructs a Meta API payload and never sees a `wa_id` beyond using it as an opaque customer key. It returns channel-agnostic reply blocks; the edge renders them.

---

## 2. Folder structure

```
ai-service/
├── src/
│   ├── mastra/
│   │   ├── index.ts                  # Mastra instance, registers agents + storage
│   │   ├── agents/
│   │   │   ├── shopping-agent.ts     # main agent, full tool set
│   │   │   └── fast-agent.ts         # cheap model, trivial turns only
│   │   ├── tools/
│   │   │   ├── search-products.ts
│   │   │   ├── check-availability.ts
│   │   │   ├── get-cart.ts
│   │   │   ├── update-cart.ts
│   │   │   ├── request-confirmation.ts
│   │   │   ├── place-order.ts
│   │   │   └── index.ts              # barrel, single import for agent
│   │   ├── memory/
│   │   │   └── config.ts             # thread + resource scoping, working memory
│   │   └── prompts/
│   │       ├── shopping-agent.md     # system prompt, loaded at build
│   │       └── fast-agent.md
│   │
│   ├── domain/                       # ⚠ shared by tools AND dashboard routes
│   │   ├── catalog/
│   │   │   ├── search.ts             # hybrid search: vector + trigram + aliases
│   │   │   ├── aliases.ts            # colloquial → canonical mapping
│   │   │   └── availability.ts
│   │   ├── cart/
│   │   │   ├── read.ts
│   │   │   └── mutate.ts             # the ONLY place carts are written
│   │   ├── orders/
│   │   │   ├── create.ts
│   │   │   ├── transition.ts         # status machine, emits notify events
│   │   │   └── read.ts
│   │   └── retailers/
│   │       └── resolve.ts            # customer → serving retailer
│   │
│   ├── api/
│   │   ├── agent-turn.ts             # POST /agent/turn — called by edge
│   │   ├── health.ts
│   │   └── dashboard/
│   │       ├── orders.ts             # GET/PATCH — called by FE
│   │       └── inventory.ts
│   │
│   ├── reply/
│   │   ├── types.ts                  # ReplyBlock union — shared contract
│   │   └── build.ts                  # helpers: text(), buttons(), cartSummary()
│   │
│   ├── notify/
│   │   └── push.ts                   # calls edge POST /notify on order events
│   │
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema
│   │   └── client.ts
│   │
│   └── lib/
│       ├── trace.ts                  # traceId propagation + structured logging
│       └── errors.ts
│
├── evals/
│   ├── fixtures/conversations.json   # 15–20 scripted turns incl. Manglish
│   └── run.ts                        # replay against agent, assert tool calls
│
├── scripts/
│   ├── seed-catalog.ts               # demo SKUs + embeddings
│   └── seed-aliases.ts               # hand-written colloquial terms
│
├── .env.example
└── README.md
```

**The rule that keeps this honest:** files under `src/mastra/tools/` contain zero business logic. Each is a schema plus a call into `src/domain/`. The dashboard routes call the same domain functions. If a tool ever writes SQL directly, the retailer view and the customer view will disagree.

---

## 3. Agent design

### Two agents, one router

Most turns are trivial ("yes", "2kg", "no onions"). Running the full tool-equipped agent on those wastes 800ms and tokens.

- **fast-agent** — cheap model, no tools except `get-cart` and `update-cart`. Handles confirmations, quantity edits, greetings.
- **shopping-agent** — full tool set. Handles new product requests, ambiguous intent, substitutions.

Route with a cheap classifier or simple heuristics on the incoming text plus whether a cart exists. When in doubt, route to shopping-agent — a slow correct answer beats a fast wrong one.

### Memory scoping

| Mastra concept | Our value | Lifetime |
|---|---|---|
| `resourceId` | `customer:{customerId}` | Forever — enables preference recall across orders |
| `threadId` | `session:{sessionId}` | Until order placed or 30 min idle |

Working memory holds: preferred brands, dietary constraints, usual quantities, default delivery address. This is the "remembers you" moment in the demo — seed it for at least one demo customer.

### Tool set

All tools receive `retailerId` and `customerId` from the run context, never from the model.

| Tool | Input | Returns | Notes |
|---|---|---|---|
| `searchProducts` | `query`, `attributes?`, `limit?` | ranked products with id, name, brand, unit, price, inStock | Hybrid search. Never returns out-of-catalog items. |
| `checkAvailability` | `productIds[]` | per-id stock + suggested substitutes | Substitutes come from the domain layer, not the model |
| `getCart` | — | full cart with line items and total | |
| `updateCart` | `action` (add/remove/set), `productId`, `quantity`, `unit` | **the complete new cart** | Always returns full state so the model can't drift |
| `requestOrderConfirmation` | — | cart summary + short-lived `confirmationToken` | Token TTL 5 min |
| `placeOrder` | `confirmationToken`, `deliveryNote?` | `orderId`, status, ETA | **Rejects without a valid token.** Deterministic gate, not a model decision. |

### Non-negotiables

1. **Grounding.** Every product, price, and quantity the agent mentions must have come from a tool result in the current turn. This goes in the system prompt and in an eval.
2. **Cart lives in Postgres**, never in conversation context. The model reads it through `getCart`.
3. **Order placement is gated in code.** `placeOrder` without a token is a 4xx, regardless of what the model intended.
4. **Retailer scoping happens in the domain layer**, inside the function signature, so no entry point can forget it.

---

## 4. Retrieval

Product matching is the highest-risk component. Framework choice will not save you here.

**Hybrid search, three signals merged by reciprocal rank fusion:**
1. pgvector cosine similarity on product name + description embeddings
2. Postgres `pg_trgm` similarity for typos and transliteration variants
3. Exact lookup against the hand-seeded alias table

**Alias table is mandatory, not optional.** Seed it by hand for every SKU in the demo catalog. Malayalam and Manglish terms, brand nicknames, category shorthand. Examples:

| Alias | Canonical |
|---|---|
| chaya podi, tea powder | Tea |
| kadala | Chickpeas |
| mulaku podi | Chilli powder |
| thairu, curd | Yoghurt |
| kozhi | Chicken |

Fifty hand-written aliases will outperform anything clever built in 36 hours.

**Guardrail:** if top result score is below threshold, the agent asks a clarifying question rather than guessing. Silent wrong matches are worse than one extra turn.

---

## 5. Reply blocks

The agent returns an array of blocks. The edge renders them into Meta's format. Defined in `src/reply/types.ts` — this file is a shared contract, changes need the edge dev's agreement.

```ts
type ReplyBlock =
  | { type: 'text'; body: string }
  | { type: 'buttons'; body: string; buttons: { id: string; label: string }[] }
  | { type: 'list'; body: string; header?: string;
      rows: { id: string; title: string; description?: string }[] }
  | { type: 'cart_summary'; items: CartLine[]; total: number; currency: 'INR' }
```

**WhatsApp limits the agent must respect** (enforce in `build.ts`, not by prompting):
- `buttons`: max 3, label ≤ 20 chars
- `list`: max 10 rows, title ≤ 24 chars
- `body`: ≤ 1024 chars

Cap total blocks per turn at 2. Three messages arriving at once reads as spam.

---

## 6. Order status machine

Owned by `domain/orders/transition.ts`. Every transition emits a notify event.

```
draft → placed → accepted → packed → out_for_delivery → delivered
                     ↓
                 rejected
```

On `accepted`, `rejected`, and `out_for_delivery`, push to the edge's `/notify` endpoint so the customer hears about it on WhatsApp. This is the demo moment — build it early.

Auto-accept fallback: if a retailer doesn't act within 60 seconds, transition to `accepted` automatically. Protects the demo from a distracted teammate.

---

## 7. Observability

`traceId` is generated at the edge and threaded through everything: agent turn, every tool call, every domain function, the outbound notify. Log it as a structured field, not in the message string.

Minimum viable logging per turn: `traceId`, `customerId`, `agent` (fast/shopping), tool names called in order, total latency, model tokens.

---

## 8. Evals

`evals/fixtures/conversations.json` holds scripted turns with expected tool calls. Run before every demo.

Must cover:
- Manglish product request → correct `searchProducts` hit
- Out-of-stock item → `checkAvailability` → substitute offered
- Quantity change mid-cart → `updateCart` with correct delta
- Confirmation → `requestOrderConfirmation` then `placeOrder`
- **Grounding negative test**: ask for something not in catalog, assert the agent does not invent it

The grounding test is the one that catches the failure that will embarrass you on stage.

---

## 9. Environment

```
DATABASE_URL=
EDGE_NOTIFY_URL=            # Python edge POST /notify
EDGE_SHARED_SECRET=         # symmetric, both directions
MODEL_PROVIDER=deepseek     # deepseek | anthropic | google — apps/agent/src/mastra/models.ts
MODEL_MAIN=deepseek-flash   # or claude-haiku-4-5 / gemini-2.5-flash, matching MODEL_PROVIDER
DEEPSEEK_API_KEY=           # or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
LOG_LEVEL=info
```

Currently using DeepSeek as an interim provider (cheap, tool-calling capable) with an
env-driven switch so moving to Claude or Gemini later is a config change, not a
rewrite. `fast-agent`'s `MODEL_FAST` isn't relevant yet — that agent doesn't exist
(§10, step 7).

---

## 10. Build order

Ship in this sequence. Each step is demoable on its own.

1. Domain layer + schema + seeded catalog with aliases
2. `searchProducts` and `getCart`/`updateCart` tools, tested in Mastra Studio
3. `POST /agent/turn` returning reply blocks — stub the edge with curl
4. Confirmation gate and `placeOrder`
5. Dashboard REST + accept/reject
6. **Notify path back to WhatsApp** ← do not defer past this point
7. fast-agent routing (latency polish)
8. MCP server wrapper
9. Voice, if time remains

If you fall behind, cut from the bottom. Steps 1–6 are a complete demo.
