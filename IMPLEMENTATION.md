# Implementation Summary

WhatsApp conversational commerce platform: customers order groceries from local
retailers by text or voice on WhatsApp; retailers work the resulting orders in a
web dashboard.

pnpm workspace monorepo (`apps/*`, `packages/*`) plus one Python service.
Postgres (pgvector image) + RabbitMQ via `docker-compose.yml`.

## Service map

| Path | Stack | Role |
| --- | --- | --- |
| `apps/edge` | Python / FastAPI | WhatsApp webhook, STT, outbound send, `/notify` |
| `apps/agent` | TypeScript / Mastra | Conversational shopping agent, `POST /agent/turn` |
| `apps/api` | TypeScript / Express | Dashboard REST + WhatsApp search/select, inventory-sync worker |
| `apps/dashboard` | React / Vite | Retailer UI |
| `apps/mcp` | — | Not started (empty) |
| `packages/contracts` | Zod + mirrored Python | Cross-service wire types |
| `packages/domain` | TypeScript | Shared repositories + services over Postgres |

## Request flow

1. Meta posts to `POST /webhook` on `apps/edge`. Signature verified when
   `META_APP_SECRET` is set; the handler acks 200 immediately and does the work
   in a FastAPI background task.
2. Message type is dispatched in `edge/webhook.py` → `app/handlers.py`: text,
   audio (Sarvam STT, English/Malayalam), location, interactive (button/list
   replies), unknown.
3. The normalized turn is POSTed to `apps/agent` `/agent/turn`
   (`AGENT_TURN_URL`, `host.docker.internal:4111` from the container).
4. `apps/agent` resolves the retailer, runs the Mastra `shopping-agent`, and
   returns `AgentTurnResponse { traceId, sessionState, blocks }`.
5. `apps/edge` renders the reply blocks and sends them through the Meta Cloud
   API — logged instead when no token is configured.
6. Retailer-side status updates go the other way: `apps/api` → edge `/notify`
   (`EDGE_NOTIFY_URL`) → WhatsApp.

## apps/agent

- Express server exposing `/agent/turn` and `/health`; Mastra instance in
  `src/mastra/index.ts` with a single `shopping-agent`.
- Agent instructions are a template (`src/mastra/prompts/shopping-agent.md`)
  interpolated per request with `retailerName` / `area` pulled from Mastra
  `RequestContext`.
- Tools (`src/mastra/tools/`): `searchProducts`, `checkAvailability`, `getCart`,
  `updateCart`, `requestOrderConfirmation`, `placeOrder`. All delegate to
  `packages/domain` services and return failures as values rather than throwing.
- Confirmation gate is enforced in the domain layer: `placeOrder` requires a
  `confirmationToken` issued by `requestOrderConfirmation`.
- Sessions are tracked agent-side (`memory/session-store.ts`); the thread
  rotates after a successful `placeOrder`. The 30-minute idle boundary is not
  implemented — it needs the `sessionHint` field documented in
  `docs/contracts.md` §A1 but absent from the actual `AgentTurnRequest` schema.
- Replies are v1: always exactly one `text` block. `buttons` / `list` /
  `cart_summary` block types exist in contracts but are not emitted yet.
- Errors are swallowed into a friendly text block with HTTP 200, so the edge
  always has something to send. Each turn logs a JSON line with traceId, tool
  calls, latency and token usage.

## apps/api

Class-based Express app (`setup.ts` wires controllers, services, middlewares;
`routes/index.ts` registers them all under `/api`).

Routes:

- `GET /health`
- `POST /identify`
- `GET|POST|PATCH|DELETE /inventory`, `GET /inventory/catalog` (shop-scoped)
- `GET|PATCH /fulfillments`, `GET /fulfillments/:id`,
  `PATCH /fulfillments/:id/items/:lineId`
- `GET /shops/me`, `PATCH /shops/me`
- `GET /retailers/nearby`
- `GET /catalog/search`, `POST /catalog/availability`
- `GET|PATCH /cart/:customerId`
- `POST /orders`, `POST /orders/confirm`
- `POST /whatsapp/orders/search`, `POST /whatsapp/orders/select`
  (behind `serviceAuth`, shared secret)
- `POST /inventory-sync/:software/:shopId`

Middlewares: CORS, request logger, shop context (multi-tenant scoping), service
auth, not-found, error handler.

Async work: `inventory-sync.service.ts` wraps a POSTed vendor payload in an
envelope onto a RabbitMQ queue; `worker/inventory-sync-consumer.ts` (`worker.ts`
entrypoint) normalizes and upserts category / catalog / shop_product rows.

Notifications: `OrderNotifyService` fires right after
`OrderPlacementService.createOrder` succeeds — fulfillments auto-accept, so
there is no separate dashboard accept action — and pushes a formatted WhatsApp
message through `NotifyService` → edge `/notify`.

## packages/domain

Shared by `apps/agent` and `apps/api`, so both paths hit identical business
rules.

- Repositories: customer, shop, shop_user, category, catalog, cart, cart_item
  (via cart), master_order, shop_product, fulfillment, order_item, order_event,
  message.
- Services: `RetailerResolveService`, `CatalogSearchService`, `CartService`,
  `OrderPlacementService`, `SessionService`.
- Lib: `AppError`/`ErrorCode`, `haversineKm` (nearby retailers),
  `generateOrderCode`, `classifyMatches` + `formatIndianPrice`.

## packages/contracts

Zod schemas mirrored into `python/contracts.py` for the edge:
`OrderStatus`, `CartLine`, `ReplyBlock` (discriminated union),
`AgentTurnRequest`/`Response`, `NotifyRequest`, and the WhatsApp
search/select request-response pairs (`WhatsappSearchResponse` and
`WhatsappSelectResponse` are discriminated on `tag`).

## apps/dashboard

React + Vite + React Router + TanStack Query. Five screens split by job:

- `/` dashboard — what needs attention now
- `/orders` (+ `/orders/:orderId`) — live queue with actions
- `/history` (+ `/history/:orderId`) — finished, read-only, searchable
- `/inventory` — products, stock steppers, price cells, sync banner
- `/settings` — shop status and how orders reach the shop

Order detail is a child route of both lists so the drawer deep-links while the
list underneath keeps polling. Auth via `RequireAuth` + `useSession`; local UI
kit under `components/ui/`.

## Data model (`docs/db/schema.sql`)

`customer`, `address`, `customer_address`, `shop`, `shop_address`, `shop_user`,
`category`, `catalog`, `tag`, `shop_product`, `offer`, `cart`, `cart_item`,
`master_order`, `fulfillment`, `order_item`, `order_event`, `message`.

A `master_order` fans out into per-shop `fulfillment` rows, each holding
`order_item`s; `order_event` is the audit trail. Seeded by `docs/db/seed.sql`
on container init (`make db-reset` / `make seed`).

## Running it

    make install          # pnpm install + uv sync
    cp .env.example .env
    make db               # postgres + rabbitmq
    make agent            # :4111
    make api
    make edge             # :8000, or make edge-docker
    make dashboard

`apps/edge` opens an ngrok tunnel on boot when `NGROK_DOMAIN` is set and logs
the public webhook URL.

## Tests and CI

    pnpm --filter agent test        # vitest: fixtures, /agent/turn, tools
    cd apps/edge && uv run pytest   # webhook + fixture tests

`.github/workflows/typecheck.yml` runs `tsc --noEmit` over `@cc/domain` and
`backend` on PRs into `main` / `dev`.

## Known gaps

- `apps/mcp` is empty.
- Agent replies are text-only; the richer `ReplyBlock` variants are unused.
- Session idle-timeout rotation is missing (`sessionHint` not in the schema).
- Webhook signature verification is skipped unless `META_APP_SECRET` is set.
- CI typechecks only `@cc/domain` and `apps/api` — agent, dashboard and the
  Python edge are not gated.
