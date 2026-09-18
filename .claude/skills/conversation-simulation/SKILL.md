---
name: conversation-simulation
description: "Simulate realistic multi-turn WhatsApp customer conversations against the live running conversational-commerce stack to find runtime bugs a code review can't catch — grounding violations, broken conversational flows, gating bypasses, price/stock mistakes, contract mismatches. Verify every finding by reading logs/DB, not just the reply text. Report Problem/Fix pairs ranked by severity, then fix them one at a time with the user's steer on scope."
argument-hint: "Optionally name a focus area (e.g. \"payment and address flow\", \"the new catalog\", \"multi-shop split\") or a specific customer number/scenario to reproduce. Defaults to a broad sweep across the categories below."
---

# Conversation Simulation — conversational-commerce

This is **runtime behavior testing**, not a diff review (see the separate `pr-review` skill for that).
The bugs worth finding here only show up when a real conversation actually runs against the live
stack: an LLM composing a broken reply, a code path that's reachable in theory but never actually
exercised, a contract field that serializes differently than the schema expects. Several of this
project's worst bugs (orders never decrementing stock, customer coordinates never persisted so shop
routing was silently dead, a live 400 breaking every real WhatsApp message) were invisible to
`tsc --noEmit` and only surfaced by actually running conversations and checking the database.

Two parts, same shape as `pr-review`: **Part A — Simulate & Report**, **Part B — Fix loop**. Don't
start fixing before Part A's findings are shown to the user, *except* for something actively
breaking every live message right now (see "Immediate fixes" below) — flag those the moment you find
them, fix, verify, then keep going with the rest of the sweep.

---

## Part A — Simulate & Report

### 1. Confirm the stack is actually live

```
curl -s http://localhost:4111/health   # apps/agent
curl -s http://localhost:4000/api/health  # apps/api
curl -s http://localhost:8000/health   # apps/edge
```

If any are down, start them per the root `README.md` (`pnpm --filter agent dev`, `pnpm --filter
backend dev`, `cd apps/edge && uv run uvicorn edge.main:app --reload --port 8000`) and re-check
before simulating — a 000/timeout is an infra problem, not a finding.

Check `docker compose ps` for `db`/`rabbitmq` too. If you're about to test something time-sensitive
(shop hours, token expiry), check the current time (`date`) against `shop.opening_time`/
`closing_time` in the DB first — don't mistake real "outside business hours" behavior for a bug (it
isn't; see the "Shop hours" category below), and don't casually widen hours or reset data without
asking (see "Read the room on destructive setup" below).

### 2. Two ways to send a turn — use both, don't rely on only one

**Direct to the agent** (fast, isolates conversation logic):

```
curl -s -X POST http://localhost:4111/agent/turn -H "Content-Type: application/json" \
  -d '{"traceId":"sim-1","messageId":"sim-1","customerRef":"<phone>","text":"<message>","source":"text"}'
```

**Through the real edge webhook** (exercises the actual ingestion path):

```
curl -s -X POST http://localhost:8000/webhook -H "Content-Type: application/json" -d '{
  "entry":[{"changes":[{"value":{"messages":[{"id":"wamid.x","from":"<phone>","type":"text","text":{"body":"<message>"}}]}}]}]
}'
```
(`/location`, `/interactive` trigger endpoints under `apps/edge`'s `/docs` also exist for those
message types — see `app/routers/`.)

**Do not rely on the direct-to-agent shortcut alone.** A hand-crafted minimal JSON payload silently
omits whatever optional contract fields you didn't think to include — and that gap can hide a real
bug. This actually happened: `AgentTurnRequest.media` broke on the *TS* side because the *Python*
side always sends an explicit `"media": null` (pydantic's `Optional[X] = None` serializes as JSON
`null`, not an absent key) while the Zod schema only had `.optional()`, not `.nullable().optional()`
— rejecting every real message with a 400. A minimal curl payload that just omits `media` entirely
never reproduces this; only a payload built from the *actual current* `AgentTurnRequest` shape (every
field, nulls included) or a real webhook round-trip catches it. When testing anything touching
`packages/contracts`, always route at least one check through the real edge webhook, and when
building a direct payload, read the current contract file first and include every field explicitly.

Pick a fresh, never-used `customerRef` per scenario so conversations don't bleed into each other
(unless the scenario is specifically about session continuity). Real Indian mobile numbers aren't
required — any digit string works against the seed data.

### 3. Design scenarios like a real customer, not a test matrix

Write actual, slightly messy WhatsApp messages — typos, mixed English/Malayalam/Manglish, quantities
in words, multiple items in one message, changing your mind mid-sentence. A flat list of one-item,
one-turn exchanges won't find the bugs that live in state transitions. Draw from these categories
(not exhaustive — extend for whatever the current catalog/feature set actually supports):

**Cart building**
- Vague item name (no quantity) → does it ask sensibly or guess?
- Multiple items in one message, one available / one not → does the reply cover *both* outcomes, or
  does it drop one?
- Add, then swap for something else, then change quantity, then remove one — does the cart end up
  matching what was actually said, not what the first message implied?
- An item genuinely not in the catalog → must say so plainly, never invent a substitute
  (**grounding** — CLAUDE.md rule 5).
- Whole-catalog price/name check: does the reply's price match `shop_product.selling_price` in the
  DB, not a stale or invented number?

**Checkout**
- Address given as text, then changed to a different address before confirming.
- Payment method given, ambiguous ("pay when it arrives"), or given together with the address in one
  message.
- The same message contains both missing details *and* "place order" — does it complete the whole
  thing in one turn, and does the final reply describe the *outcome* (placed) without leftover
  "Confirm?" phrasing it already answered itself?
- Cart changed *after* a confirmation summary was shown but *before* saying yes — must re-confirm
  with the new total, not place the stale one.
- An expired confirmation token (force it: `UPDATE master_order SET token_expires_at = NOW() -
  interval '10 minutes' WHERE ...`) — should self-heal (re-confirm, re-place) or fail honestly, never
  silently claim success without actually placing.
- Immediately after an order is placed, ask to cancel/change/check on "that order" in the same
  chat — the session's memory intentionally resets here (see `docs/spec.md`'s session table), so the
  model won't remember specifics, but it must never *deny* the order happened.

**Shop state**
- Outside opening hours (or `is_active=false`) → must be refused deterministically, in code, before
  any LLM call runs. Verify via the log: no `Retailer resolved` line, no tool-call trace, fast
  response (well under a second) — if it took several seconds or shows tool calls, the code-level
  gate isn't actually short-circuiting.
- Right at zero stock → next customer for that item must be refused with a real substitute, not
  oversold. Verify `shop_product.stock_quantity`/`is_available` in the DB before and after, not just
  the reply text.

**Location & multi-shop**
- A real WhatsApp location share (via `/location`) → coordinates must persist to
  `customer_address`/`address` in the DB, not just get acknowledged in text.
- Two different real locations in the same conversation, each near a different shop → primary shop
  resolution should genuinely flip (check the `primaryShop` field in the agent log).
- A cart built from items exclusive to two different shops → confirmation should show an anonymized
  multi-store breakdown (never a real shop name — CLAUDE.md and this prompt both forbid it), and
  placing it should create *one* `master_order` with *two* `fulfillment` rows, each shop's dashboard
  (`GET /api/fulfillments` with its own `X-Shop-Id`) seeing only its own slice.

**Message quality**
- Garbage/minimal input (a single "?", an emoji, silence) → graceful, not a crash or a hallucinated
  answer.
- A genuinely repeated customer message (same content, *different* messageId, i.e. they actually
  typed it twice) vs. a true Meta webhook retry (identical messageId) — the first should get a
  sensible "already in your cart, did you mean 2x?" style clarification, never a silent double-add;
  the second must be deduped before it ever reaches the agent (check the edge log for the dedup skip
  line, and that only one WhatsApp send happened).
- Off-topic questions, complaints about a past/nonexistant order, price negotiation attempts — should
  redirect briefly, never invent capabilities the bot doesn't have (no `cancelOrder` tool exists,
  for example — it must not pretend otherwise).
- Heavy code-switching (Manglish, Malayalam in Latin script) — reply should mirror the customer's own
  mix, not translate it into something more formal.
- Voice-sourced turns (`"source":"voice"`) on a brand-new session with no address on file — the
  first reply should ask for the address before anything else, then resume the original request once
  answered (memory carries it — same thread, just deferred).

### 4. What actually counts as a bug — the checklist

For every reply, check:
- **Grounding**: no product, price, stock status, address, or location stated unless it came from a
  real tool result *this turn* (or was typed by the customer themselves). This includes not
  fabricating an address from a pasted map link or raw coordinates — the model cannot resolve those.
- **No glued/duplicate text**: a sentence-ending punctuation mark immediately followed by a capital
  letter with zero whitespace is never normal prose — it's either the model re-drafting the same
  reply (exact or reworded) or narrating two *different* sequential outcomes without a paragraph
  break (e.g. asking a question it already answered itself in the same breath). Both are bugs; tell
  them apart by word-overlap between the two halves, not by assuming either is "fine."
- **No filler-only turns**: "I'll check that" / "Let me look into it" is never an acceptable final
  reply — by reply time the tool calls already ran.
- **Gates hold**: `placeOrder` never succeeds without a real `confirmationToken` from
  `requestOrderConfirmation`; address/payment/shop-open checks block placement exactly as designed,
  not just as a prompt suggestion.
- **No shop-name leakage** anywhere customer-facing (chat replies *and* WhatsApp notify templates).
- **State actually changed, not just the reply text** — cross-check the DB (`master_order`,
  `fulfillment`, `shop_product.stock_quantity`, `customer_address`) and the service logs
  (`agent.log`'s tool-call trace, `edge.log`'s send/dedup lines) after every scenario that's supposed
  to persist something. A correct-sounding reply with no matching DB row is still a bug.

### 5. Read the room on destructive setup

Some scenarios need DB state changes (forcing an expired token, draining stock to zero, widening
shop hours to test outside a demo). Small, targeted, reversible SQL (`UPDATE`, not `DELETE`/`TRUNCATE`)
on a handful of rows is fine to do directly. A full reset (`docker compose down -v` / `make
db-reset`) wipes everything, including any real accumulated orders/customers — **always confirm with
the user first** if a fix or a fresh schema genuinely requires it; never do it as a side effect of
"let me get a clean slate for testing."

### 6. Report findings in this exact format

Rank by severity: **Blocker/Critical → High → Medium → Low**.

```
**N. <one-line problem name>**
- **Problem:** <what's actually wrong, concretely — what you sent, what happened, what should have
  happened. Cite the log line / DB row / file:line that proves it, not just the reply text.>
- **Fix:** <direction, not a full diff>
```

- Every "Problem" must be something you personally reproduced this session — a specific `curl`, a
  specific reply, a specific DB check. "This looks like it might..." doesn't belong here.
- If something is actively breaking *every* live message right now (not a scenario-specific edge
  case — a genuine regression in the hot path), say so plainly and fix it immediately rather than
  waiting for the full report; note it as already-fixed when you present the rest.
- A "not a bug" is worth one line too if it disproves a plausible-looking suspicion (e.g. "shop
  correctly closed per real opening hours, not a gating bug") — it saves the user from re-litigating
  it later.

### 7. Present the report, then stop

Show the numbered list (already-fixed regressions marked as such). End with a one-line handoff into
Part B: "Want me to go through the rest in severity order, or pick specific ones?"

---

## Part B — Fix loop

Same shape as `pr-review`'s Part B:

1. **Ask which finding(s) to work on** via `AskUserQuestion` (multiSelect on) if more than one
   remains and scope isn't obvious — especially if a fix means finishing someone else's in-progress
   feature (a half-built integration is a *scope* question, not just a bug; offer "minimal safe fix"
   vs "full completion" vs "leave it" as options, the way the WhatsApp-native-cart price-trust issue
   was handled here — the user may prefer to leave a teammate's in-progress work alone).
2. **Implement the fix**, scoped to that finding only.
3. **Verify by re-running the exact scenario that found it** — same `curl`, same DB check, same log
   grep. Don't just typecheck; typechecking didn't catch any of the bugs this skill exists to find.
4. Also run the relevant test suites and typechecks as a regression net (`pnpm --filter agent
   test`, `pnpm --filter agent/backend/dashboard typecheck`, `cd apps/edge && uv run pytest`) —
   necessary but not sufficient on their own here.
5. Restart the affected service(s) if the fix touched a file outside what the dev-mode watcher covers
   (cross-package files in `packages/*` aren't watched by `apps/edge`'s `uvicorn --reload`, and a
   prompt `.md` file loaded via `readFileSync` at module load isn't re-read until the process
   actually restarts — touching a watched `.ts` file to force a reload, or a full kill+relaunch,
   isn't optional for those cases).
6. Update the finding's status (fixed / skipped / deferred per the user's call), loop back to step 1
   with what's left.

Stay conversational. Never fix something the user didn't select or that requires taking a stance on
someone else's in-progress work without asking first.
