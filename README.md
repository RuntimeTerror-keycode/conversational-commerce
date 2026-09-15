# conversational-commerce

WhatsApp conversational shopping platform. Hackathon build.
Customers order groceries from local retailers through natural text or voice on WhatsApp.

- `apps/edge` — Python/FastAPI: WhatsApp webhook, STT, outbound send
- `apps/agent` — TypeScript/Mastra: conversational agent, `POST /agent/turn`
- `apps/api` — TypeScript: dashboard REST (orders, inventory)
- `apps/dashboard` — retailer UI (not started)
- `apps/mcp` — MCP server for Claude/Codex (not started)
- `packages/contracts` — shared types, mirrored TS + Python
- `packages/domain` — shared cart/order/catalog logic used by both `apps/agent` and `apps/api` (not built yet)

See `docs/spec.md` and `docs/contracts.md`.

## Why is there a root `package.json` / `node_modules`?

This is a pnpm workspace monorepo. The root `package.json` just declares the
`packageManager` version and top-level scripts (`pnpm -r build`, `pnpm -r
typecheck` — fan out to every TS package). `pnpm-workspace.yaml` lists the
member packages (`apps/agent`, `apps/api`, `apps/dashboard`, `apps/mcp`,
`packages/*`). The root `node_modules/` is where pnpm hoists shared
dependencies and symlinks workspace packages into each other — e.g.
`apps/agent`'s `@cc/contracts: "workspace:*"` dependency resolves through a
symlink pnpm creates there. It's `.gitignore`'d, same as every other
`node_modules/`.

## Status

Walking skeleton is in place: a message can travel edge → agent → back to
edge with no AI in the loop yet.

- `apps/edge` verifies the Meta webhook signature, acks 200 immediately, then
  calls `apps/agent` in a background task and logs the stubbed outbound send.
- `apps/agent` exposes `POST /agent/turn`, validates against
  `AgentTurnRequest` from `@cc/contracts`, and returns a hardcoded reply
  block.
- `apps/api` exists as a bare skeleton (`GET /health` only) — dashboard
  routes land once `packages/domain` exists.
- Mastra, the database, and the tool set are not wired up yet.

## Setup

    make install
    cp .env.example .env
    make db
    make agent      # terminal 1
    make api        # terminal 2
    make edge       # terminal 3
    make dashboard  # terminal 4

## Tests

    pnpm --filter agent test
    cd apps/edge && uv run pytest
