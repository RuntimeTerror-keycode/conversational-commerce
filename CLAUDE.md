# conversational-commerce

WhatsApp conversational shopping platform. Hackathon build.
Customers order groceries from local retailers through natural text or voice on WhatsApp.

## Read first

- `docs/spec.md` — AI service design, folder structure, tool definitions, build order
- `docs/contracts.md` — interface contracts between the three services
- `packages/contracts/src/index.ts` — the authoritative shared types

## Layout

| Path | Language | Owns |
|---|---|---|
| `apps/edge` | Python / FastAPI | WhatsApp webhook, STT, outbound send |
| `apps/agent` | TypeScript / Mastra | Conversational agent — `POST /agent/turn` |
| `apps/api` | TypeScript | Dashboard REST (orders, inventory) |
| `apps/dashboard` | React | Retailer order + inventory UI |
| `apps/mcp` | TypeScript | MCP server for Claude/Codex |
| `packages/contracts` | TS + Python mirror | Shared types |
| `packages/domain` | TypeScript | Shared domain layer (cart, orders, catalog) — not built yet |

`apps/agent` and `apps/api` are separate deploys owned by different devs. Neither imports the other's `src/`; anything they both need to touch (cart, orders, catalog, retailers) belongs in `packages/domain`, imported by both.

**Open question, not yet resolved:** order status transitions (accept/reject) happen in `apps/api`'s dashboard routes, but `POST /notify` back to the edge (docs/contracts.md §A2) was originally the AI service's job. Since `apps/api` now owns order mutation, it likely owns the `/notify` call too — confirm this before building the notify path, and update docs/contracts.md §A2 and §E once decided.

## Architecture rules — do not violate without asking

1. **One domain layer, two entry points.** Mastra tools in `apps/agent/src/mastra/tools/` and dashboard REST routes in `apps/api/src/api/` both call into `packages/domain` — schema/routing only, zero business logic, zero SQL, in either app.

2. **Cart lives in Postgres, never in conversation context.** The agent reads it via `getCart`. `mutateCart` returns the complete cart, not a diff.

3. **Order placement is gated in code.** `placeOrder` requires a valid `confirmationToken` from `requestOrderConfirmation`. Reject without one regardless of model intent.

4. **`retailerId` is the first argument to every domain function.** Scoping is enforced inside the function, not by the caller.

5. **Grounding.** The agent may only mention products, prices, and stock that came from a tool result in the current turn.

6. **The edge acks Meta before doing any work.** Webhook returns 200, then processes in a background task. Never block the ack on the agent.

7. **Reply blocks are channel-agnostic.** `apps/agent` never constructs Meta API JSON. The edge renders.

8. **Contract changes touch both languages.** Edit `packages/contracts/src/index.ts` and `packages/contracts/python/contracts.py` together, and keep `fixtures/*.json` valid against both.

## Conventions

- TypeScript: no `any`, Zod schemas for all tool inputs, Drizzle for DB access
- Python: Pydantic models at every boundary, `httpx.AsyncClient` for outbound
- `traceId` threads through everything — generated at the edge, logged as a structured field on every tool call and domain function
- No secrets in code. Everything through `.env`, mirrored in `.env.example`

## Commands

    make install     # pnpm install + uv sync
    make db          # postgres + pgvector in docker
    make agent       # Mastra dev server (also opens Studio)
    make api         # dashboard REST dev server
    make edge        # FastAPI on :8000
    make dashboard   # Vite dev server

## Build order

Ship in the order listed at the end of `docs/spec.md`. Steps 1–6 are a complete demo; voice is step 9 for a reason. If asked to jump ahead, say so.

## Context

Kerala, India. Customers write English, Malayalam, and Manglish (Malayalam in Latin script), often mixed in one message. Product search must handle colloquial terms — the hand-seeded alias table in `packages/domain/src/catalog/aliases.ts` matters more than the embedding model.
