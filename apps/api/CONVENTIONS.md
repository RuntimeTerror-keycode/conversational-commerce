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
├── constants/
│   └── index.ts                      # Enums, valid transitions, fixed mappings — no logic
├── types/
│   ├── index.ts                      # Barrel — re-exports all type files + shared types
│   ├── <domain>.types.ts             # Types for one domain (request/response shapes)
│   └── ...
├── repositories/
│   └── <domain>.repository.ts        # Raw SQL queries — returns typed rows, no business logic
├── services/
│   └── <domain>.service.ts           # Business logic, validation — calls repository, throws AppError
├── controllers/
│   └── <domain>.controller.ts        # HTTP adapter — parses req, calls service, sends res
├── routes/
│   ├── index.ts                      # RouteRegistrar — mounts all route modules
│   └── <domain>.route.ts             # Route definitions for a domain
├── middlewares/
│   └── <name>.middleware.ts          # Express middleware classes
├── lib/
│   ├── db.ts                         # Database pool (pg)
│   ├── rabbitmq.ts                   # Message broker (amqplib)
│   └── app-error.ts                  # Typed error class with HTTP status codes
└── logger/
    └── logger.ts                     # Logger class — level-aware structured logging
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

### 2. Layered Architecture (Separation of Concerns)

Every domain is split into four layers. Data flows **down only** — a layer may call the layer directly below it. Services may call other services.

```
Route → Controller → Service → Repository → Database
                        ↕
                  (shared services)
```

| Layer | Responsibility | May call | Must NOT |
| ------------ | ---------------------------------- | ------------ | ----------------------------------- |
| **Route** | Maps HTTP verbs/paths to controller methods. Applies domain-specific middleware. | Controller | Contain logic, call service/repo |
| **Controller** | Parses `req` (params, query, body). Calls service. Sends `res`. | Service | Write SQL, throw business errors, import repository |
| **Service** | Business rules, validation, orchestration. Transforms repo rows into response shapes. Throws `AppError`. | Repository, other Services, Database (for transactions) | Import `Request`/`Response`, access `req`/`res` |
| **Repository** | Raw SQL queries. Returns typed row interfaces. One method per query. | Database | Throw `AppError`, contain business logic, format responses |

**Repository naming — by table, not by feature:**
- Each repository file owns **one primary table**.
- Joins to related tables are fine (e.g., `shop_product` repo joins `catalog` + `category`).
- Name the file after the primary table: `shop-product.repository.ts`, `order-item.repository.ts`.
- If two features need the same table, they share the same repository — that's the point.

**Service naming — by reusability, not by controller:**
- A top-level service method called by a controller is exclusive to that controller.
- Shared logic lives in a **shared service** injected into other services.
- Example: `ShopProductRepository` is injected into both `FulfillmentService` and `InventoryService`.
- When a service needs to write across multiple tables atomically, it uses `Database.transaction()` and calls repo methods with the transaction client.

**Rules:**
- Controllers are thin — parse input, delegate to service, send output. No `if (status !== 'accepted')` logic in controllers.
- Services own all business decisions. If a rule exists ("only accepted fulfillments can be edited"), it lives in the service.
- Repositories own all SQL. If a query changes, only the repository file changes.
- Row types (DB result shapes) are private to the repository file. Domain/API types live in `src/types/`.
- Cross-table transactions are coordinated by the **service**, not the repository.

### 3. Types and Constants

**Types** live in `src/types/`, one file per domain plus a barrel `index.ts`.

```
src/types/
├── index.ts                # Re-exports all domain type files + shared types
├── identify.types.ts       # IdentifyRequest, IdentifyResponse, etc.
├── fulfillment.types.ts    # FulfillmentSummary, FulfillmentDetail, etc.
└── inventory.types.ts      # ProductSummary, InventoryCounts, etc.
```

`src/types/index.ts` is the **barrel file**. All consumers import from `'../types'`, never from `'../types/session.types'` directly. When adding types, export them from the domain file and re-export from the barrel.

**Constants** live in `src/constants/index.ts`. This file contains:
- Status enums and their valid values
- Transition maps (which status can move to which)
- Column mappings and other fixed data
- No logic — just data.

### 4. Singleton Config

`Config` is a singleton that reads `process.env` exactly once at startup.

```typescript
const config = Config.getInstance();
const port = config.values.port;
```

**Rules:**
- Never call `process.env` directly outside of `Config`.
- Environment variables are injected by `env-cmd` at process start (reads `.env`). No runtime `.env` parsing in application code.
- To add a new env var: add it to `AppConfig` interface, read it in the `Config` constructor, update `.env.example`.

### 5. Route Registration

Each domain gets its own route file exporting a class with a `router` property.

```typescript
export class FooRoute {
  public readonly router: Router;

  constructor(controller: FooController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.router.use(shopContext.handle); // if route needs shop scoping
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: FooController): void {
    this.router.get('/foo', controller.list);
  }
}
```

Then register it in `RouteRegistrar.register()`:

```typescript
const fooRoute = new FooRoute(this.controllers.foo, this.middlewares.shopContext);
this.app.use('/api', fooRoute.router);
```

### 6. Middleware

Middlewares are classes with a `handle` arrow-function property matching the Express signature.

### 7. Dependency Injection

`Setup.createDependencies()` is the DI composition root. It wires:

```
Database → Repositories (one per table, shared across services)
                ↓
           Services (may depend on multiple repos + other services)
                ↓
           Controllers
```

No class instantiates its own dependencies. Everything is passed through constructors.
A single repository instance can be injected into multiple services (e.g., `ShopProductRepository` is used by both `FulfillmentService` and `InventoryService`).

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
| Route files       | `<domain>.route.ts`                | `fulfillment.route.ts`           |
| Controller files  | `<domain>.controller.ts`           | `fulfillment.controller.ts`      |
| Service files     | `<domain>.service.ts`              | `fulfillment.service.ts`         |
| Repository files  | `<table>.repository.ts`            | `shop-product.repository.ts`     |
| Type files        | `<domain>.types.ts`                | `fulfillment.types.ts`           |
| Middleware files  | `<name>.middleware.ts`             | `shop-context.middleware.ts`     |

---

## Adding a New Domain (Step-by-Step)

1. Create `src/types/<domain>.types.ts` — request/response interfaces.
2. Re-export from `src/types/index.ts`.
3. Add any constants to `src/constants/index.ts`.
4. Create `src/repositories/<table>.repository.ts` — one per table. Reuse an existing repo if the table already has one (e.g., `shop-product.repository.ts` is shared by fulfillment and inventory).
5. Create `src/services/<domain>.service.ts` — business logic. Inject all needed repos. If cross-table transactions are needed, also inject `Database` and coordinate via `db.transaction()`.
6. Create `src/controllers/<domain>.controller.ts` — thin HTTP adapter calling service.
7. Create `src/routes/<domain>.route.ts` — wires routes to controller.
8. Register the route in `src/routes/index.ts` inside `RouteRegistrar.register()`.
9. Wire repos → services → controllers in `src/setup.ts`. A single repo instance can be passed to multiple services.
10. Run `npm run typecheck`.

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

| Variable       | Type   | Default       | Description              |
| -------------- | ------ | ------------- | ------------------------ |
| `NODE_ENV`     | string | `development` | Runtime environment      |
| `PORT`         | number | `4000`        | HTTP server port         |
| `LOG_LEVEL`    | string | `info`        | Logging verbosity        |
| `DATABASE_URL` | string | —             | Postgres connection string |
| `RABBITMQ_URL` | string | —             | AMQP connection string   |

---

## AI Agent Instructions

When modifying this codebase as an AI agent, follow these rules strictly:

1. **Read this file first** before making any changes.
2. **Maintain class-based patterns** — never introduce standalone exported functions.
3. **Follow the layered architecture** — controller → service → repository. No skipping layers.
4. **Use `Config.getInstance()`** — never read `process.env` directly.
5. **Follow the naming table** exactly for files, classes, and variables.
6. **Run `npm run typecheck`** after every change to verify correctness.
7. **Follow the code style rules** defined in this document.
8. **Do not add packages** without explicit user approval.
9. **Types go in `src/types/<domain>.types.ts`**, re-exported from `src/types/index.ts`. Row types stay in repository files.
10. **Constants go in `src/constants/index.ts`** — no inline magic values in services or controllers.
11. **Register new routes** in `RouteRegistrar` — do not mount them ad-hoc in `App`.
12. **Wire dependencies in `src/setup.ts`** — classes never instantiate their own deps.
