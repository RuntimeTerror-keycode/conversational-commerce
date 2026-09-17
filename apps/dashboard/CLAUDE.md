# Shopkeeper Portal — Frontend

React + Vite + Tailwind dashboard for shopkeepers to manage inventory,
orders, and shop settings.

## Always read before UI work
- `DESIGN_SYSTEM.md` — BINDING. All visual decisions come from here.
- `src/styles/tokens.css` — the tokens themselves.
- `frontend_contract.md` — BINDING. All data shapes and endpoints.

## Locked decisions — do not re-open
- React + Vite + Tailwind + React Router
- Server state: TanStack Query. UI state: Context. No Redux.
- Primitives: Radix, styled with our tokens. No pre-styled component library.
- Icons: Lucide. 20px default, 16px in buttons and badges.
- Forms: React Hook Form + Zod, schemas derived from frontend_contract.md
- Class merging: `cn()` helper using clsx + tailwind-merge

## Hard rules
- Tailwind's default palette is REMOVED from config on purpose.
  `bg-blue-500` will not compile. Do not re-add it.
- No raw hex, px, or arbitrary values in components. Tokens only.
  Need a new value? Add it to tokens.css first.
- NO dummy data in application code. No sample arrays, no faker, no
  placeholder objects. Mocks live in tests only.
- API base URL from VITE_API_BASE_URL with NO fallback. If unset,
  render an explicit configuration-error screen.
- Never invent an endpoint or field absent from frontend_contract.md.
- Every data view handles loading / empty / error / success for real.
- Every interactive component implements all seven states
  (DESIGN_SYSTEM.md §6).

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — eslint