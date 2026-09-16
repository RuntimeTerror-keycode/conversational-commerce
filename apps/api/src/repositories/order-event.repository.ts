import { PoolClient } from 'pg';

import { Database } from '../lib/db';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface OrderEventRow {
  id: number;
  eventType: string;
  actor: string;
  note: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Repository — primary table: order_event
// ---------------------------------------------------------------------------

export class OrderEventRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public async findByFulfillment(fulfillmentId: number): Promise<OrderEventRow[]> {
    const result = await this.db.query<OrderEventRow>(
      `SELECT
        id,
        event_type AS "eventType",
        actor,
        note,
        created_at AS "createdAt"
      FROM order_event
      WHERE fulfillment_id = $1
      ORDER BY created_at DESC`,
      [fulfillmentId],
    );
    return result.rows;
  }

  /** Insert an event within an existing transaction. */
  public async insert(client: PoolClient, fulfillmentId: number, eventType: string, actor: string, note: string): Promise<void> {
    await client.query(
      `INSERT INTO order_event (fulfillment_id, master_order_id, event_type, actor, note)
       SELECT $1, master_order_id, $2, $3, $4
       FROM fulfillment WHERE id = $1`,
      [fulfillmentId, eventType, actor, note],
    );
  }
}
