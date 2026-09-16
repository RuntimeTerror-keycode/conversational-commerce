# conversational-commerce — agent instructions

WhatsApp conversational shopping for local Kerala retailers. Customers order
groceries by text or voice in English, Malayalam, or Manglish. Hackathon-shaped
monorepo; treat the architecture rules below as hard constraints.

## Read first

| Doc | Purpose |
|---|---|
| `spec.md` | Product + system design, journeys, lifecycle, build order |
| `agent.md` | Mastra shopping-agent tools, prompts, turn contract, stubs |
| `docs/contracts.md` | Edge ↔ agent ↔ dashboard interface contracts (may lag product decisions — see below) |
| `packages/contracts/src/index.ts` | Authoritative shared Zod types (+ Python mirror) |

Attached team contracts (also inform this file): agent-domain, WhatsApp,
frontend dashboard. When they disagree with older `docs/*`, prefer the newer
product decisions recorded in `spec.md` §3–4 and §14.

## Layout

| Path | Language | Owns |
|---|---|---|
| `apps/edge` | Python / FastAPI | WhatsApp webhook, STT, outbound send, `POST /notify` |
| `apps/agent` | TypeScript / Mastra | Conversational agent — `POST /agent/turn` |
| `apps/api` | TypeScript / Express | Dashboard REST under `/api` (orders, inventory, auth) |
| `apps/dashboard` | React / Vite | Retailer fulfilment + inventory UI |
| `apps/mcp` | TypeScript | MCP server for Claude/Codex (scaffold) |
| `packages/contracts` | TS + Python mirror | Shared wire types + fixtures |
| `packages/domain` | TypeScript | Shared cart / orders / catalog / retailers — **not built yet** |

`apps/agent` and `apps/api` are separate deploys. Neither imports the other's
`src/`. Anything both must touch belongs in `packages/domain`.

**Branches note:** `main` may be nearly empty. Product code lives on feature
branches (`feat/mastra-shopping-agent`, `feat/be-boiler-plate`,
`feature/whatsapp-integration`, `feat/fe-dashboard`, `feat/walking-skeleton`).
Read across branches before assuming a file is missing.

## Architecture rules — do not violate without asking

1. **One domain layer, two entry points.** Mastra tools in
   `apps/agent/src/mastra/tools/` and dashboard routes in `apps/api` both call
   `packages/domain`. Schema/routing only in the apps — **zero business logic,
   zero SQL** outside domain.

2. **Cart lives in Postgres (domain), never in conversation context.** Agent
   reads via `getCart`. `mutateCart` / `updateCart` returns the **complete**
   cart, not a diff.

3. **Order placement is gated in code.** `placeOrder` / `createOrder` requires a
   valid `confirmationToken` from `requestOrderConfirmation` (TTL 5 minutes).
   Reject without one regardless of model intent.

4. **`retailerId` is the first argument to every domain function** (or derived
   server-side for HTTP). Scoping is enforced inside the function / session —
   never trust the model or the browser to supply tenancy.

5. **Grounding.** The agent may only mention products, prices, and stock that
   came from a tool result in the **current turn**. Working memory must not
   store catalogue facts.

6. **The edge acks Meta before doing any work.** Webhook returns 200, then
   processes in a background task. Never block the ack on the agent.

7. **Reply blocks are channel-agnostic.** `apps/agent` never constructs Meta API
   JSON. The edge renders `ReplyBlock` (and may map to WhatsApp `found` /
   `choice` tags).

8. **Contract changes touch both languages.** Edit
   `packages/contracts/src/index.ts` and `packages/contracts/python/contracts.py`
   together; keep `fixtures/*.json` valid.

9. **Dashboard talks only to `apps/api`.** Never call agent or edge from the
   frontend. Service token stays out of the browser.

10. **Inventory decrement belongs in domain.** `managed` vs `external`
    `inventoryMode` is read by the UI; the client never sends a "decrement or
    not" flag.

11. **Fulfilment split (product decision 2026-09-15).** System auto-accepts
    `placed → accepted`. Shopkeeper advances
    `accepted → packed → out_for_delivery → delivered` from the dashboard.
    **No accept/reject controls in the UI.** Prefer immediate auto-accept over a
    60s dead wait. Older `docs/contracts.md` §C3 rules about one-click
    accept/reject and "unaccepted count" are superseded — update that file when
    editing contracts; do not reintroduce accept/reject endpoints for the FE.

12. **`POST /notify` ownership.** Prefer `apps/api` inside `transitionOrder`
    (and auto-accept). Confirm before building; then update `docs/contracts.md`
    §A2 / §E. Fires for `order_accepted`, `order_rejected`, `out_for_delivery`,
    `substitution`.

## Conventions

- **TypeScript:** no `any`; Zod at boundaries; named exports; Drizzle when DB
  lands. Agent: Mastra tools with Zod inputs. API (`feat/be-boiler-plate`):
  class-based modules, kebab-case files, `Config` singleton, no ad-hoc
  `process.env` outside Config, `Logger` not `console` in business logic. See
  `apps/api/CONVENTIONS.md` / `AGENTS.md` on that branch.
- **Python:** Pydantic at every boundary; `httpx.AsyncClient` for outbound.
- **`traceId`:** generated at the edge; structured field on every hop (turn,
  tools, domain, notify). Prefer threading into domain (`opts.traceId` or ambient
  context) — today it often stops at the turn boundary.
- **Secrets:** only via `.env`, mirrored in `.env.example`. Never commit tokens.
- **Money:** undecided (rupees vs paise). Stubs use integer rupees (`320`).
  Decide once in `packages/contracts` before mixing formats.
- **Currency / locale:** INR; `Asia/Kolkata`; Malayalam product names must render
  in the dashboard (font stack must include Malayalam).

## Commands

```
make install     # pnpm install + uv sync in apps/edge
make db          # postgres + pgvector
make agent       # Mastra / agent on :4111
make api         # dashboard REST on :4000 (boilerplate uses env-cmd + npm on be branch)
make edge        # FastAPI on :8000
make dashboard   # Vite
```

Tests:

```
pnpm --filter agent test
pnpm --filter agent typecheck
cd apps/edge && uv run pytest
```

## Build order

Ship in the order in `spec.md` §12. Steps 1–6 are a complete demo (domain →
search/cart → turn → confirmation → dashboard fulfilment + auto-accept →
notify). Voice and fast-agent are last. If asked to jump ahead, say so.

Domain swap priority for unblocking the agent: `searchProducts` first, then
cart, then confirmation/`createOrder`, then availability / `resolveRetailer`.

## Context — Kerala

Customers write English, Malayalam, and Manglish, often in one message. Product
search must handle colloquial terms. The hand-seeded alias table
(`packages/domain/src/catalog/aliases.ts` when it exists) matters more than the
embedding model. Backend hosts the file; the AI side seeds and extends entries
from daily testing.

## Status snapshot

- Edge skeleton: signature verify, ack-then-agent, stub Meta send.
- WhatsApp integration branch: richer Meta UX (lists, polls, location, audio).
- Agent: real shopping-agent; **tools stubbed**; text-only reply blocks.
- API: health + Express class boilerplate; dashboard routes pending domain.
- Dashboard: not started; build from frontend contract + `spec.md`.
- `packages/domain`: not built — agent and API are not blocked from parallel
  work if they respect the domain signatures in `agent.md` §6.

## When editing docs or contracts

- Prefer updating `spec.md` / `agent.md` / this file together so product
  decisions (auto-accept, inventory modes, notify ownership) do not drift.
- Do not silently reintroduce superseded accept/reject dashboard flows.
- Flag conflicts instead of inventing a third API shape.
