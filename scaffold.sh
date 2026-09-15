#!/usr/bin/env bash
set -euo pipefail

# conversational-commerce monorepo scaffold
# Run from the directory where you want the repo created.
# If the repo already exists, cd into it and skip to STEP 2.

ROOT="conversational-commerce"

# ---------------------------------------------------------------
# STEP 1 — repo root
# ---------------------------------------------------------------
mkdir -p "$ROOT" && cd "$ROOT"
git init -b main

cat > package.json <<'EOF'
{
  "name": "conversational-commerce",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "make dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  }
}
EOF

cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/api"
  - "apps/dashboard"
  - "apps/mcp"
  - "packages/*"
EOF

cat > .gitignore <<'EOF'
node_modules/
dist/
.turbo/
.next/
.env
.env.local
__pycache__/
.venv/
*.db
.DS_Store
EOF

mkdir -p apps packages docs

# ---------------------------------------------------------------
# STEP 2 — shared contracts package (the reason this is a monorepo)
# ---------------------------------------------------------------
mkdir -p packages/contracts/src packages/contracts/python packages/contracts/fixtures

cat > packages/contracts/package.json <<'EOF'
{
  "name": "@cc/contracts",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": { "zod": "^3.23.8" }
}
EOF

cat > packages/contracts/src/index.ts <<'EOF'
import { z } from "zod";

export const OrderStatus = z.enum([
  "draft", "placed", "accepted", "rejected",
  "packed", "out_for_delivery", "delivered",
]);

export const CartLine = z.object({
  lineId: z.string(),
  productName: z.string(),
  sourceText: z.string().optional(),
  quantity: z.number(),
  unit: z.string(),
  price: z.number(),
});

export const ReplyBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string().max(1024) }),
  z.object({
    type: z.literal("buttons"),
    body: z.string().max(1024),
    buttons: z.array(z.object({ id: z.string(), label: z.string().max(20) })).max(3),
  }),
  z.object({
    type: z.literal("list"),
    body: z.string().max(1024),
    header: z.string().optional(),
    rows: z.array(z.object({
      id: z.string(),
      title: z.string().max(24),
      description: z.string().optional(),
    })).max(10),
  }),
  z.object({
    type: z.literal("cart_summary"),
    items: z.array(CartLine),
    total: z.number(),
    currency: z.literal("INR"),
  }),
]);

export const AgentTurnRequest = z.object({
  traceId: z.string(),
  messageId: z.string(),
  customerRef: z.string(),
  text: z.string(),
  source: z.enum(["text", "voice"]),
  locale: z.string().nullable().optional(),
});

export const AgentTurnResponse = z.object({
  traceId: z.string(),
  blocks: z.array(ReplyBlock).max(2),
  sessionState: z.enum(["active", "order_placed"]),
});

export const NotifyRequest = z.object({
  traceId: z.string(),
  customerRef: z.string(),
  blocks: z.array(ReplyBlock).max(2),
  reason: z.enum(["order_accepted", "order_rejected", "out_for_delivery", "substitution"]),
});

export type ReplyBlock = z.infer<typeof ReplyBlock>;
export type AgentTurnRequest = z.infer<typeof AgentTurnRequest>;
export type AgentTurnResponse = z.infer<typeof AgentTurnResponse>;
export type NotifyRequest = z.infer<typeof NotifyRequest>;
EOF

cat > packages/contracts/python/contracts.py <<'EOF'
"""Pydantic mirror of packages/contracts/src/index.ts.
Both sides parse packages/contracts/fixtures/*.json in their tests.
If you change one side and not the other, those tests go red."""
from typing import Literal, Optional, Union
from pydantic import BaseModel, Field

class TextBlock(BaseModel):
    type: Literal["text"]
    body: str = Field(max_length=1024)

class Button(BaseModel):
    id: str
    label: str = Field(max_length=20)

class ButtonsBlock(BaseModel):
    type: Literal["buttons"]
    body: str = Field(max_length=1024)
    buttons: list[Button] = Field(max_length=3)

class ListRow(BaseModel):
    id: str
    title: str = Field(max_length=24)
    description: Optional[str] = None

class ListBlock(BaseModel):
    type: Literal["list"]
    body: str = Field(max_length=1024)
    header: Optional[str] = None
    rows: list[ListRow] = Field(max_length=10)

class CartLine(BaseModel):
    lineId: str
    productName: str
    sourceText: Optional[str] = None
    quantity: float
    unit: str
    price: float

class CartSummaryBlock(BaseModel):
    type: Literal["cart_summary"]
    items: list[CartLine]
    total: float
    currency: Literal["INR"]

ReplyBlock = Union[TextBlock, ButtonsBlock, ListBlock, CartSummaryBlock]

class AgentTurnRequest(BaseModel):
    traceId: str
    messageId: str
    customerRef: str
    text: str
    source: Literal["text", "voice"]
    locale: Optional[str] = None

class AgentTurnResponse(BaseModel):
    traceId: str
    blocks: list[ReplyBlock] = Field(max_length=2)
    sessionState: Literal["active", "order_placed"]

class NotifyRequest(BaseModel):
    traceId: str
    customerRef: str
    blocks: list[ReplyBlock] = Field(max_length=2)
    reason: Literal["order_accepted", "order_rejected", "out_for_delivery", "substitution"]
EOF

cat > packages/contracts/fixtures/agent-turn.json <<'EOF'
{
  "traceId": "trc_demo_001",
  "messageId": "wamid.demo001",
  "customerRef": "919999999999",
  "text": "2 kg ari und?",
  "source": "text",
  "locale": "mixed"
}
EOF

cat > packages/contracts/fixtures/agent-turn-response.json <<'EOF'
{
  "traceId": "trc_demo_001",
  "sessionState": "active",
  "blocks": [
    {
      "type": "list",
      "body": "Rice ind. Ethu venam?",
      "rows": [
        { "id": "p_101", "title": "Jaya rice 5kg", "description": "Rs 320" },
        { "id": "p_102", "title": "Matta rice 5kg", "description": "Rs 380" }
      ]
    }
  ]
}
EOF

# ---------------------------------------------------------------
# STEP 3 — placeholder dirs for the apps
# ---------------------------------------------------------------
mkdir -p apps/api apps/dashboard apps/mcp apps/edge

# ---------------------------------------------------------------
# STEP 4 — postgres + pgvector
# ---------------------------------------------------------------
cat > docker-compose.yml <<'EOF'
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: cc
      POSTGRES_PASSWORD: cc
      POSTGRES_DB: cc
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
volumes:
  pgdata:
EOF

cat > .env.example <<'EOF'
DATABASE_URL=postgresql://cc:cc@localhost:5432/cc
ANTHROPIC_API_KEY=
EDGE_NOTIFY_URL=http://localhost:8000/notify
AGENT_TURN_URL=http://localhost:4111/agent/turn
SERVICE_SHARED_SECRET=change-me
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
SARVAM_API_KEY=
EOF

# ---------------------------------------------------------------
# STEP 5 — Makefile (orchestrates TS + Python together)
# ---------------------------------------------------------------
cat > Makefile <<'MAKE'
.PHONY: dev db api edge dashboard install

install:
	pnpm install
	cd apps/edge && uv sync

db:
	docker compose up -d db

api:
	pnpm --filter api dev

dashboard:
	pnpm --filter dashboard dev

edge:
	cd apps/edge && uv run uvicorn edge.main:app --reload --port 8000

dev: db
	@echo "Run these in separate terminals: make api / make edge / make dashboard"
MAKE

cat > README.md <<'EOF'
# conversational-commerce

WhatsApp conversational shopping platform.

- `apps/edge` — Python/FastAPI: WhatsApp webhook, STT, outbound send
- `apps/api` — TypeScript/Mastra: agent, domain services, dashboard REST
- `apps/dashboard` — retailer UI
- `apps/mcp` — MCP server for Claude/Codex
- `packages/contracts` — shared types, mirrored TS + Python

See `docs/spec.md` and `docs/contracts.md`.

## Setup
    make install
    cp .env.example .env
    make db
    make api      # terminal 1
    make edge     # terminal 2
    make dashboard # terminal 3
EOF

git add -A && git commit -qm "scaffold: monorepo skeleton and shared contracts"

echo ""
echo "Skeleton done. Now run the framework scaffolders (STEP 6 in the chat)."
