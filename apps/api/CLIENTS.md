# apps/api — Postgres & RabbitMQ client usage

Both clients are injected through `Setup.createDependencies()` and available
on `AppDependencies` as `db` and `broker`.

## Environment

```env
DATABASE_URL=postgresql://kadakaran:kadakaran@localhost:5432/kadakaran
RABBITMQ_URL=amqp://kadakaran:kadakaran@localhost:5672
```

Start infra with `make db` (runs both Postgres and RabbitMQ).

---

## Database (`db: Database`)

Source: `src/lib/db.ts`

### Simple query

```ts
const { rows } = await this.db.query<{ id: number; name: string }>(
  'SELECT id, name FROM catalog WHERE category_id = $1',
  [categoryId],
);
```

### Parameterised insert

```ts
await this.db.query(
  'INSERT INTO order_event (master_order_id, event_type, actor) VALUES ($1, $2, $3)',
  [orderId, 'placed', 'customer'],
);
```

### Transaction

Multiple statements that must all succeed or all roll back:

```ts
const order = await this.db.transaction(async (client) => {
  const { rows: [master] } = await client.query(
    `INSERT INTO master_order (order_code, customer_id, address_id, status, total_amount)
     VALUES ($1, $2, $3, 'placed', $4) RETURNING *`,
    [orderCode, customerId, addressId, total],
  );

  await client.query(
    `INSERT INTO fulfillment (master_order_id, shop_id, status, subtotal)
     VALUES ($1, $2, 'accepted', $3)`,
    [master.id, shopId, subtotal],
  );

  return master;
});
```

If any statement throws, the entire transaction rolls back. The client is
released automatically.

### Access in a controller or service

Inject `Database` through the constructor — same pattern as `HealthController`:

```ts
import { Database } from '../lib/db';

export class OrderController {
  constructor(private readonly db: Database) {}

  public list = async (req: Request, res: Response): Promise<void> => {
    const { rows } = await this.db.query('SELECT * FROM fulfillment WHERE shop_id = $1', [req.params.shopId]);
    res.json({ data: rows });
  };
}
```

Register it in `setup.ts`:

```ts
controllers: {
  health: new HealthController(db, broker),
  order: new OrderController(db),
},
```

---

## Message Broker (`broker: MessageBroker`)

Source: `src/lib/rabbitmq.ts`

### Publish a message

```ts
await this.broker.publish('order.events', {
  type: 'status_changed',
  fulfillmentId: 12,
  status: 'packed',
  shopId: 1,
  timestamp: new Date().toISOString(),
});
```

Messages are JSON-serialised, persistent (survives broker restart), and sent to
a durable queue (created automatically if it doesn't exist).

### Subscribe to a queue

```ts
interface OrderEvent {
  type: string;
  fulfillmentId: number;
  status: string;
  shopId: number;
}

await this.broker.subscribe<OrderEvent>('order.events', async (data, msg) => {
  console.log(`Order ${data.fulfillmentId} is now ${data.status}`);
  // process the event...
});
```

- Messages are auto-acked after the handler returns successfully.
- If the handler throws, the message is nacked and requeued.
- Use `{ prefetch: 5 }` as the third argument to limit concurrent processing.

### Set up subscriptions at startup

Add subscribers in `index.ts` after `broker.connect()`:

```ts
await deps.broker.connect();

await deps.broker.subscribe('order.events', async (data) => {
  deps.logger.info('Order event', data);
});

const app = new App(deps);
app.listen();
```

### Access in a controller

```ts
export class OrderController {
  constructor(
    private readonly db: Database,
    private readonly broker: MessageBroker,
  ) {}

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    // ... update DB ...

    await this.broker.publish('order.events', {
      type: 'status_changed',
      fulfillmentId: req.params.id,
      status: req.body.status,
    });

    res.json({ ok: true });
  };
}
```

---

## Health check

`GET /api/health` now reports the status of both services:

```json
{
  "status": "ok",
  "timestamp": "2026-09-16T12:00:00.000Z",
  "checks": {
    "service": true,
    "db": true,
    "rabbitmq": true
  }
}
```

Returns `200` when all checks pass, `503` when any check fails.

---

## Graceful shutdown

Both clients are closed on `SIGINT` / `SIGTERM` (handled in `src/index.ts`).
The broker drains in-flight messages before closing the channel.
