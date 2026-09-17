# apps/dashboard

Retailer portal. React + Vite + TypeScript + Tailwind.

Talks only to `apps/api` (`/api`, port 4000). Never to `apps/agent` or `apps/edge`.

    make dashboard      # or: pnpm --filter dashboard dev

## Configuration

`VITE_API_BASE_URL` must point at a running `apps/api`. There is no fallback
and no fixture/demo-data mode — if it's unset, the app renders an explicit
configuration-error screen (`src/app/ConfigErrorScreen.tsx`) instead of the
router. See `.env.example`.

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
├── app/          router, providers, shell, auth guard, config-error screen
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
