# conversational-commerce

WhatsApp conversational shopping platform. Hackathon build.
Customers order groceries from local retailers through natural text or voice on WhatsApp.

- `apps/edge` — Python/FastAPI: WhatsApp webhook, STT, outbound send
- `apps/api` — TypeScript: agent turn endpoint, domain services, dashboard REST
- `apps/dashboard` — retailer UI (not started)
- `apps/mcp` — MCP server for Claude/Codex (not started)
- `packages/contracts` — shared types, mirrored TS + Python

See `docs/spec.md` and `docs/contracts.md`.

## Status

Walking skeleton is in place: a message can travel edge → api → back to edge
with no AI in the loop yet.

- `apps/edge` verifies the Meta webhook signature, acks 200 immediately, then
  calls `apps/api` in a background task and logs the stubbed outbound send.
- `apps/api` exposes `POST /agent/turn`, validates against `AgentTurnRequest`
  from `@cc/contracts`, and returns a hardcoded reply block.
- Mastra, the database, and the tool set are not wired up yet.

## Setup

    make install
    cp .env.example .env
    make db
    make api      # terminal 1
    make edge     # terminal 2
    make dashboard # terminal 3

## Tests

    pnpm --filter api test
    cd apps/edge && uv run pytest
