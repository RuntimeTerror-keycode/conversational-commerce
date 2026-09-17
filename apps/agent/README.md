# apps/agent

TypeScript/Mastra conversational agent. Owns `POST /agent/turn` (called by
`apps/edge`) and, eventually, the domain-facing tool set.

## Status

`shopping-agent` (full tool set) is wired up. Every tool is a stub — fake
in-memory data, not `packages/domain` (that's the BE devs' side; see the
`// STUB` comment at the top of each file in `src/mastra/tools/`). No
`fast-agent`/router yet (deferred per `docs/spec.md` §10, step 7).

Reply blocks are v1: the agent's free-text answer always comes back as one
`{ type: "text" }` block. No `buttons`/`list`/`cart_summary` generation yet —
see the plan notes for why.

## Setup

```
cp .env.example .env
# fill in DEEPSEEK_API_KEY (or switch MODEL_PROVIDER/MODEL_MAIN to anthropic/google)
pnpm --filter agent dev
```

## Tests

```
pnpm --filter agent test        # all mocked/no network — safe for CI
pnpm --filter agent typecheck
```

## Manual verification

With the agent running on `:4111` and a real API key in `.env`:

```bash
curl -s -X POST http://localhost:4111/agent/turn \
  -H "Content-Type: application/json" \
  -d @../../packages/contracts/fixtures/agent-turn.json | jq
```

Expect a `200` with one `text` block and `sessionState: "active"`.

To exercise the full path (edge webhook → agent → stubbed Meta send), see the
curl command in the root `README.md` — point `apps/edge`'s `AGENT_TURN_URL` at
this server and run both.
