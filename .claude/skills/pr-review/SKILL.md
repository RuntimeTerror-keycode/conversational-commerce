---
name: pr-review
description: "Review a PR/branch diff on conversational-commerce like a staff engineer, against this repo's own CLAUDE.md architecture rules and docs/contracts.md. Verify every claim by reading real code and running each touched service's typecheck/build. Report findings as short Problem/Fix pairs ranked by severity, then loop letting the user pick which to fix one at a time."
argument-hint: "Give a base ref and head ref, e.g. `origin/dev...nav/feat-ai-be-apis`, or a GitHub PR number/URL. Defaults to comparing the current branch against origin/dev if you don't specify."
---

# PR Review — conversational-commerce

Staff-engineer review of a diff in **this repo**: a WhatsApp conversational-commerce platform with
three cooperating services (`apps/edge` Python/FastAPI, `apps/agent` TS/Mastra, `apps/api` TS
dashboard REST) plus `apps/dashboard`, `apps/mcp`, and shared `packages/contracts` /
`packages/domain`. The goal is not style nitpicks — it's catching things that **break the system or
contradict this repo's documented architecture and cross-service contracts**, then helping fix them
one at a time.

Two parts: **Part A — Review**, **Part B — Interactive fix loop**. Do not start editing before
Part A's report has been shown to the user.

---

## Part A — Review

### 1. Resolve what's being compared

- No ref given → diff the current branch against `origin/dev` (this repo's integration branch;
  fall back to `origin/main` if `dev` doesn't exist on the remote).
- Branches/tags/commits given → use them directly: `git diff <base>...<head>`.
- A GitHub PR number/URL → `gh pr view <n> --json baseRefName,headRefName,url`, `gh pr diff <n>`.
- Two separate checkouts/worktrees → resolve each to a comparable ref (add one as a remote, or
  `diff -ru` ignoring `.git`/`node_modules`/`.venv`/lockfiles).

Confirm in one line what's being diffed (e.g. "Reviewing `origin/dev...nav/feat-ai-be-apis`, 34
files changed") before continuing. If truly ambiguous, ask via `AskUserQuestion`.

### 2. Load this repo's own rules — always, in this order

1. **Root `CLAUDE.md`.** Read it in full every time; it's short and it's the authority. Pay
   specific attention to the numbered **"Architecture rules — do not violate without asking"**:
   - One domain layer, two entry points — `apps/agent/src/mastra/tools/` and `apps/api`'s dashboard
     routes both call into `packages/domain` (schema/routing only, zero business logic, zero SQL in
     either app). **Note:** `packages/domain` may not exist yet per the layout table — if so, this
     is known, pre-existing drift; only flag it as a *new* problem if the diff makes the drift worse
     (e.g. adds a large new chunk of business logic straight into an app instead of the shared
     package), and always flag it if the diff is exactly the kind of shared logic (cart, orders,
     catalog, retailers) the rule calls out.
   - Cart lives in Postgres, never in conversation context; `mutateCart` returns the full cart, not
     a diff.
   - Order placement is gated in code — `placeOrder`/`createOrder` must require a valid
     `confirmationToken` from the confirm step and reject without one, and must place what was
     actually confirmed (check for a real snapshot, not a live re-read of mutable state at
     placement time — this exact bug has happened here before).
   - `retailerId` (or the shop/tenant scoping id) is the first argument to every domain function;
     scoping enforced inside the function, not by the caller.
   - Grounding — `apps/agent` may only surface products/prices/stock that came from a tool result
     in the current turn.
   - The edge acks Meta before doing any work; webhook returns 200 then processes in a background
     task; never block the ack on the agent.
   - Reply blocks are channel-agnostic — `apps/agent` never constructs Meta API JSON; the edge
     renders.
   - Contract changes touch both languages — `packages/contracts/src/index.ts` **and**
     `packages/contracts/python/contracts.py` change together, and `fixtures/*.json` stay valid
     against both.
   - Check the **"Open question, not yet resolved"** note about `POST /notify` ownership — read
     `docs/contracts.md`'s changelog to see if it's actually been resolved since CLAUDE.md was last
     updated (it may be stale in one direction or the other); don't assume either doc is current
     without checking the other.
2. **`docs/spec.md`** — AI service design, tool definitions, build order. Check the diff isn't
   jumping ahead of the stated build order (steps 1–6 are the demo; voice is step 9 for a reason).
3. **`docs/contracts.md`** — the frozen interface contracts (§A edge↔AI, §C1 domain function
   signatures the agent tools call, §C2 dashboard REST + scoping rules, §D `ReplyBlock` union, §E
   changelog of what's been agreed/changed). This is the single most important file to diff the PR
   against — most of the highest-value bugs in this repo are contract drift between what this file
   says and what `apps/api`/`apps/agent` actually built.
4. **`packages/contracts/src/index.ts`** (and its Python mirror) — the authoritative shared Zod
   types. Cross-check against §D/§A of `docs/contracts.md` and against any new types the diff adds
   under `apps/api/src/types` or similar — duplicate, parallel type definitions that drift from the
   shared package are a common bug shape here.
5. **`apps/api/CONVENTIONS.md`** and **`apps/api/AGENTS.md`** if the diff touches `apps/api` — the
   layered architecture (Route → Controller → Service → Repository → DB, data flows down only),
   naming conventions, no-`any`/no-default-export rules, and the "Adding a New Domain" checklist.
   A new domain added to `apps/api` should follow that checklist exactly (types → constants →
   repository → service → controller → route → register in `RouteRegistrar` → wire in `setup.ts`).
6. Any new docs the **PR itself adds** (e.g. new files under `docs/`) — read these against the
   existing frozen docs above. A PR that adds a new "contract" doc that quietly disagrees with
   `docs/contracts.md`, or that describes agent-side stub code that doesn't actually exist yet in
   `apps/agent`, is exactly the kind of self-contradiction to catch — verify claims like "the agent
   already calls this" by checking the file actually exists.

### 3. Get the full diff

```
git diff <base>...<head> --stat
git diff <base>...<head> > <scratchpad>/pr.diff
```

Read the diffstat first for shape, then the full diff. For any touched service/business-logic file,
**read the whole current file**, not just the hunk — this repo's real bugs (e.g. an order-placement
flow that silently re-reads the live cart instead of a confirmed snapshot) are invisible from a diff
alone.

### 4. Investigate — verify, don't assume

- **Trace the specific cross-service contracts this repo cares about**: does `getCart`/`mutateCart`/
  `createOrder`/`resolveRetailer`/etc. actually match the signatures in `docs/contracts.md` §C1 and
  `packages/contracts`? Does `retailerId` (or shop id) genuinely scope every query, or does some
  path accept it from the caller without re-validating? Does a confirmation-token flow actually
  bind to and later re-check what was confirmed, rather than recomputing from mutable state?
- **Check the DB schema is consistent**: `docs/db/schema.sql` and `docs/db/RELATIONS.md` vs. the
  SQL in any new/changed repository file — column names, defaults, and status enums should match
  across the repository code, the schema, and the docs.
- **Confirm files/functions cited in new docs actually exist** (`grep`, `find`) before trusting a
  claim like "X already calls this."
- **Run the actual verification command for each service the diff touches** — don't assume, run it:
  - `apps/api`: `cd apps/api && npm install --ignore-scripts && npx tsc --noEmit` (Husky runs this
    exact command pre-commit; `--ignore-scripts` avoids the husky `prepare` script failing outside
    a normal git context).
  - `apps/agent` / `apps/mcp` / `apps/dashboard`: check `package.json` for a `typecheck`/`build`/
    `test` script and run it the same way.
  - `apps/edge`: Python — `uv sync` then whatever test/lint command the project defines (check for
    `pytest`, `ruff`, or similar); Pydantic boundary models should match `packages/contracts/python/contracts.py`.
  A real compiler/test failure is the strongest evidence you can cite — prefer it over inference.
- Prefer being right about a handful of things over listing many maybes. Drop anything you can't
  verify by reading code or running a command.

### 5. Write findings in this exact format

Rank by severity: **Blocker/Critical → High → Medium → Low**.

```
**N. <one-line problem name>**
- **Problem:** <what's actually wrong, concretely — file:line where useful, one or two sentences>
- **Fix:** <what should change, one or two sentences — direction, not a full diff>
```

- Short. No paragraphs, no restating the investigation, no hedging.
- Every "Problem" must be something you personally verified this session (code read, command run).
- Every "Fix" is a direction, not a mandate — the developer may know constraints you don't.
- Minor/dead-code/stale-doc items go in a short trailing "Low / notes" group instead of inflating
  severity.

### 6. Present the report, then stop

Show the numbered list. Do not open a PR, post a comment, or edit anything yet. End with a one-line
handoff into Part B, e.g.: "Want me to draft a fix plan for any of these? Tell me which one(s), or
I can go in severity order."

---

## Part B — Interactive fix loop

Repeat until the user says they're done or no open findings remain:

1. **Ask which finding(s) to work on next** via `AskUserQuestion` (multiSelect on), remaining open
   findings as options, up to 4 per question, ordered by severity. If more than 4 remain, list the
   rest in a preceding text line and let the user name one via the automatic "Other" option. Always
   include a "None — I'm done for now" option.
2. **For each finding picked**, draft a short fix plan first (what changes, in which files, any
   cross-service impact — e.g. does this also need a `packages/contracts` update on both languages
   per rule 8?) and get the user's go-ahead before editing, unless they've already said to proceed
   autonomously.
3. **Implement the fix**, scoped to that finding only.
4. **Verify**: re-run whatever check proved the original finding (typecheck/test/manual trace) and
   confirm it's actually resolved.
5. **Update the finding's status** (fixed / skipped / deferred), drop it from the open list.
6. **Loop back to step 1** with what's left. Don't stop after one fix unless told to.

Stay conversational. Never fix something the user didn't select, and never silently skip a finding
without saying so.
