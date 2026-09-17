# @cc/domain — shared domain logic

Shared business logic for the conversational-commerce platform.
Used by `apps/api` (dashboard REST) and intended for `apps/agent` (Mastra AI service).

## Install

Already wired in the pnpm workspace. Add to any app's `package.json`:

```json
{
  "dependencies": {
    "@cc/domain": "workspace:*"
  }
}
```

Then run `pnpm install` from the repo root.

## What's inside

| Directory | Contains |
|---|---|
| `src/types/di.ts` | `IDatabase`, `ILogger` — DI contracts your app must implement |
| `src/types/db.ts` | All database row interfaces (`CustomerRow`, `ShopWithLocationRow`, etc.) |
| `src/types/domain.ts` | Agent-facing API shapes (`DomainCart`, `DomainProduct`, `OrderConfirmationResponse`, etc.) |
| `src/constants.ts` | Shared constants (`minFulfillmentAmount`, `cartActions`, `masterOrderStatuses`) |
| `src/lib/app-error.ts` | `AppError` class with static factories (`notFound`, `validation`, etc.) |
| `src/lib/geo.ts` | `haversineKm` distance helper |
| `src/repositories/` | All database repository classes (one per table/entity) |
| `src/services/` | Domain services — retailer resolve, catalog search, cart, order placement |

Everything is re-exported from `src/index.ts`, so a single import path works:

```ts
import { CartService, DomainCart, IDatabase, AppError } from '@cc/domain';
```

## Dependency injection

Repositories and services don't own a database connection. Your app provides two interfaces:

### IDatabase

```ts
interface IDatabase {
  query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  getClient(): Promise<PoolClient>;
  transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
}
```

Wraps a `pg.Pool`. See `apps/api/src/lib/db.ts` for a reference implementation.

### ILogger

```ts
interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(context: string): ILogger;
}
```

`apps/api` uses a Winston-based logger. Any logger that satisfies this interface works.

## Wiring example

```ts
import {
  CustomerRepository,
  ShopRepository,
  CatalogRepository,
  CartRepository,
  MasterOrderRepository,
  ShopProductRepository,
  FulfillmentRepository,
  OrderItemRepository,
  OrderEventRepository,
  RetailerResolveService,
  CatalogSearchService,
  CartService,
  OrderPlacementService,
} from '@cc/domain';

// db and logger must satisfy IDatabase and ILogger
const customerRepo = new CustomerRepository(db);
const shopRepo = new ShopRepository(db);
const catalogRepo = new CatalogRepository(db);
const cartRepo = new CartRepository(db);
const masterOrderRepo = new MasterOrderRepository(db);
const shopProductRepo = new ShopProductRepository(db);
const fulfillmentRepo = new FulfillmentRepository(db);
const orderItemRepo = new OrderItemRepository(db);
const orderEventRepo = new OrderEventRepository(db);

const retailerService = new RetailerResolveService(customerRepo, shopRepo, logger);
const catalogService = new CatalogSearchService(catalogRepo, retailerService, logger);
const cartService = new CartService(
  cartRepo, catalogRepo, customerRepo, shopProductRepo, retailerService, logger,
);
const orderPlacementService = new OrderPlacementService({
  cartRepo, customerRepo, shopRepo, masterOrderRepo,
  fulfillmentRepo, orderItemRepo, orderEventRepo,
  db, logger,
});
```

## Calling services

All domain services take string IDs that match the agent-facing API (customer phone, retailer ID, product ID). Parsing and DB lookup happen internally.

### Retailer resolution

```ts
const result = await retailerService.resolve('+919876543210');
// { primary: { retailerId, name, area }, nearby: [...] }
```

### Catalog search

```ts
const products = await catalogService.searchProducts('+919876543210', 'milk bread');
// DomainProduct[]

const availability = await catalogService.checkAvailability('1', ['10', '11']);
// AvailabilityResult[]
```

### Cart

```ts
const cart = await cartService.getCart('+919876543210');
// { items, total, currency, priceNote }

const updated = await cartService.mutateCart('+919876543210', {
  action: 'add', productId: '10', quantity: 2, unit: 'kg',
});
```

### Order placement

Two-step flow — request confirmation, then place:

```ts
const confirmation = await orderPlacementService.requestConfirmation(
  '+919876543210',
  ['1', '2'],  // nearby shop IDs from retailerService
);
// { summary, total, confirmationToken, expiresAt, shopBreakdown }

const order = await orderPlacementService.createOrder(confirmation.confirmationToken);
// { orderId, status: 'placed', etaMinutes } or { error: true, reason }
```

## Types quick reference

### Domain types (agent-facing)

| Type | Used for |
|---|---|
| `ResolveRetailerResponse` | Response from `retailerService.resolve()` |
| `DomainProduct` | Single search result |
| `AvailabilityResult` | Stock check per product |
| `DomainCart`, `DomainCartLine` | Cart read/write responses |
| `CartOpInput` | Cart mutation input (`add` / `remove` / `set`) |
| `OrderConfirmationResponse` | Confirmation step response |
| `CreateOrderResponse` | Order placement response (success or failure) |
| `ConfirmedSnapshot`, `SnapshotAssignment`, `SnapshotItem` | Persisted order snapshot |

### DB row types

Named `<Entity>Row` or `<Entity><Variant>Row` — one per query shape. These are useful if you need to work with raw repository results directly.

### DI interfaces

| Interface | Purpose |
|---|---|
| `IDatabase` | Database connection wrapper |
| `ILogger` | Structured logger |
