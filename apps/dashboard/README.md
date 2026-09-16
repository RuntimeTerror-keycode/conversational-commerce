# apps/dashboard

Retailer portal. React + Vite + TypeScript + Tailwind.

Talks only to `apps/api` (`/api`, port 4000). Never to `apps/agent` or `apps/edge`.

    make dashboard      # or: pnpm --filter dashboard dev

## Fixtures

`VITE_USE_FIXTURES` defaults to on. Every screen is served from
`src/fixtures/`, an in-memory stand-in for `apps/api` — so the dashboard can be
built and demoed before the backend routes exist, and a dead API on stage is
not a dead demo. Set `VITE_USE_FIXTURES=false` to talk to the real API.

The fixture store mutates: status changes and stock edits persist for the
session, a new order arrives every 45s so the 3s poll visibly does something,
and stock decrements after each order the way `packages/domain` will.

Two switches worth knowing:

| | |
|---|---|
| `?inventoryMode=external` | Flips the shop to the synced-POS variant — read-only inventory, sync banner, no stock column |
| Sign out (Settings) | Exercises the login screen and route guard. Persisted in `sessionStorage`, so a reload does not silently sign you back in |

## Contract

`src/api/types.ts` is the authoritative frontend/backend contract and the
handover document for the backend dev. Every block is tagged `EXISTING` /
`AGREED` / `PROPOSED`, with open-question IDs inline. Rationale lives in
`docs/frontend-contract.md`.

Nothing here invents backend behaviour silently — if a field is marked
`PROPOSED`, it is not agreed yet.

## Shape of the thing

```
src/
├── api/          typed client, one module per resource, query keys
├── fixtures/     the in-memory API (delete when apps/api lands)
├── app/          router, providers, shell, auth guard
├── components/ui hand-rolled primitives
├── features/     auth · orders · inventory · settings · stats
└── lib/          money + time formatting
```

## Things that are decisions, not accidents

- **Polling, not websockets**, every 3s (`docs/contracts.md` §C3 rule 1).
- **No accept/reject.** Orders auto-accept and appear here already accepted.
  The system owns `placed → accepted`; the shopkeeper owns everything after.
- **`sourceText` on every order line** — the customer's own words next to the
  matched product (§C3 rule 3). It is the best on-screen proof the AI worked.
- **Status colour is reserved for status.** Amber only ever means "needs you".
- **Money goes through `formatMoney()`.** Whole rupees today; if the backend
  picks paise, that one function changes.
