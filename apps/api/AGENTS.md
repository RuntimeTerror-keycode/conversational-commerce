# apps/api — Agent Instructions

Read `CONVENTIONS.md` in this directory before making changes.

## What this service is

Express.js + TypeScript API server. Will become the Mastra agent host and dashboard REST layer (see root `CLAUDE.md` and `docs/spec.md`).

## Folder layout

```
src/
├── index.ts          # Entry point — calls bootstrap()
├── app.ts            # App class — Express app assembly
├── setup.ts          # Setup class — DI composition root
├── config/
│   └── config.ts     # Singleton Config (reads process.env once)
├── controllers/      # Request handlers by domain
├── logger/
│   └── logger.ts     # Logger class (level-aware, structured)
├── middlewares/       # Express middleware classes
├── routes/
│   ├── index.ts      # RouteRegistrar — mounts all route modules
│   └── *.route.ts    # Per-domain route definitions
└── types/
    └── index.ts      # Shared interfaces and type aliases
```

## Key patterns

- **Class-based architecture.** Every module exports a class, not loose functions. Use arrow-function properties for methods passed as route handlers.
- **Singleton Config.** Access env vars only through `Config.getInstance().values`. Never read `process.env` directly outside `Config`.
- **DI via Setup.** `Setup.createDependencies()` wires everything. Controllers and middlewares receive their dependencies through constructors.
- **Route registration.** Each domain gets a route class; register it in `RouteRegistrar.register()`. Do not mount routes ad-hoc in `App`.
- **Logger, not console.** Use the `Logger` class. Call `logger.child('Context')` for scoped logging.

## Commands

```
npm run dev         # Start dev server (env-cmd + tsx watch)
npm run build       # Compile to dist/
npm run typecheck   # tsc --noEmit
npm start           # Run compiled build
```

## Pre-commit

Husky runs `tsc --noEmit` before each commit. Commits are blocked if type-checking fails.

## Rules

1. Follow `CONVENTIONS.md` naming table exactly.
2. No `any`. No default exports. No `console.log` in business logic.
3. Run `npm run typecheck` after every change.
4. Do not add packages without explicit user approval.
5. Keep `src/types/index.ts` as the single location for shared types.
