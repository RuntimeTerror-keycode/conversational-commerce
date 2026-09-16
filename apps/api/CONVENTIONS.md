# Code Conventions & Contribution Guide

> This document defines the architecture, patterns, and rules for this codebase.
> It is optimized for both human developers and AI coding agents.

---

## Tech Stack

| Layer       | Technology              |
| ----------- | ----------------------- |
| Runtime     | Node.js 24.21.0 (nvm)  |
| Language    | TypeScript (strict)     |
| Framework   | Express.js              |
| Env loading | env-cmd (via npm scripts) |
| Pre-commit  | Husky                   |

---

## Project Structure

```
src/
├── index.ts                          # Entry point — calls bootstrap()
├── app.ts                            # App class — assembles middlewares, routes, error handlers
├── setup.ts                          # Setup class — wires all dependencies (DI composition root)
├── config/
│   └── config.ts                     # Singleton Config class — reads process.env once at startup
├── controllers/
│   └── <domain>.controller.ts        # Request handlers grouped by domain
├── logger/
│   └── logger.ts                     # Logger class — level-aware structured logging
├── routes/
│   ├── index.ts                      # RouteRegistrar — mounts all route modules
│   └── <domain>.route.ts             # Route definitions for a domain
├── middlewares/
│   └── <name>.middleware.ts          # Express middleware classes
└── types/
    └── index.ts                      # Shared type definitions and interfaces
```

---

## Core Patterns

### 1. Class-Based Architecture

Every module exports a **class**, not loose functions.

```typescript
// CORRECT
export class HealthController {
  public check = (_req: Request, res: Response): void => { ... };
}

// WRONG — do not export standalone functions
export function check(req: Request, res: Response) { ... }
```

**Rules:**
- Use **arrow-function properties** for methods passed as route handlers (preserves `this`).
- Mark methods that don't use a parameter with `_` prefix (`_req`, `_next`).
- Use `public` / `private` explicitly — never rely on default visibility.

### 2. Singleton Config

`Config` is a singleton that reads `process.env` exactly once at startup.

```typescript
const config = Config.getInstance();
const port = config.values.port;
```

**Rules:**
- Never call `process.env` directly outside of `Config`.
- Environment variables are injected by `env-cmd` at process start (reads `.env`). No runtime `.env` parsing in application code.
- To add a new env var: add it to `AppConfig` interface, read it in the `Config` constructor, update `.env.example`.

### 3. Route Registration

Each domain gets its own route file exporting a class with a `router` property.

```typescript
export class FooRoute {
  public readonly router: Router;
  private readonly controller: FooController;

  constructor() {
    this.router = Router();
    this.controller = new FooController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/foo', this.controller.list);
  }
}
```

Then register it in `RouteRegistrar.register()`:

```typescript
const fooRoute = new FooRoute();
this.app.use('/api', fooRoute.router);
```

### 4. Middleware

Middlewares are classes with a `handle` arrow-function property matching the Express signature.

---

## Naming Conventions

| Item              | Convention                         | Example                          |
| ----------------- | ---------------------------------- | -------------------------------- |
| Files             | `kebab-case` + suffix              | `health.controller.ts`           |
| Classes           | `PascalCase`                       | `HealthController`               |
| Interfaces        | `PascalCase`                       | `HealthResponse`                 |
| Type aliases      | `PascalCase`                       | `RouteHandler`                   |
| Variables/params  | `camelCase`                        | `healthRoute`                    |
| Constants         | `camelCase` (not UPPER_SNAKE)      | `maxRetries`                     |
| Env vars          | `UPPER_SNAKE_CASE`                 | `NODE_ENV`                       |
| Route files       | `<domain>.route.ts`                | `health.route.ts`                |
| Controller files  | `<domain>.controller.ts`           | `health.controller.ts`           |
| Middleware files  | `<name>.middleware.ts`             | `error-handler.middleware.ts`    |

---

## Adding a New Domain (Step-by-Step)

1. Create `src/controllers/<domain>.controller.ts` — class with handler methods.
2. Create `src/routes/<domain>.route.ts` — class that wires routes to controller.
3. Register the route in `src/routes/index.ts` inside `RouteRegistrar.register()`.
4. Add any shared types to `src/types/index.ts`.
5. Run `npm run typecheck`.

---

## Code Style Rules

- **Semicolons:** Always.
- **Quotes:** Single quotes.
- **Trailing commas:** Always (ES5+).
- **Indentation:** 2 spaces, no tabs.
- **Line endings:** LF.
- **Imports:** Group by: 1) node built-ins, 2) external packages, 3) internal modules. Separate groups with a blank line.
- **No default exports.** Always use named exports.
- **No `any`.** Use `unknown` and narrow with type guards when the type is truly unknown.
- **No `console.log` in business logic.** Use the `Logger` class instead.

---

## Commands Reference

| Command               | Purpose                              |
| --------------------- | ------------------------------------ |
| `npm run dev`         | Start dev server with hot reload     |
| `npm run build`       | Compile TypeScript to `dist/`        |
| `npm start`           | Run compiled production build        |
| `npm run typecheck`   | Type-check without emitting files    |

---

## Pre-Commit Hook

On every `git commit`, Husky runs **`tsc --noEmit`** to ensure type safety. If it fails, the commit is blocked.

---

## Environment Variables

All env vars are defined in `.env` (git-ignored) and documented in `.env.example` (committed).
`env-cmd` loads `.env` into `process.env` before the Node process starts — there is no runtime dotenv parsing.
Scripts that need env vars (`dev`, `start`) are prefixed with `env-cmd` in `package.json`.

| Variable    | Type   | Default       | Description              |
| ----------- | ------ | ------------- | ------------------------ |
| `NODE_ENV`  | string | `development` | Runtime environment      |
| `PORT`      | number | `4000`        | HTTP server port         |
| `LOG_LEVEL` | string | `info`        | Logging verbosity        |

---

## AI Agent Instructions

When modifying this codebase as an AI agent, follow these rules strictly:

1. **Read this file first** before making any changes.
2. **Maintain class-based patterns** — never introduce standalone exported functions.
3. **Use `Config.getInstance()`** — never read `process.env` directly.
4. **Follow the naming table** exactly for files, classes, and variables.
5. **Run `npm run typecheck`** after every change to verify correctness.
6. **Follow the code style rules** defined in this document.
7. **Do not add packages** without explicit user approval.
8. **Keep `src/types/index.ts`** as the single location for shared types.
9. **Register new routes** in `RouteRegistrar` — do not mount them ad-hoc in `App`.
10. **Match existing code style** — if unsure, look at `health.controller.ts` and `health.route.ts` as reference implementations.
