import { PoolClient } from 'pg';

import { Database } from '../lib/db';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface FulfillmentListRow {
  id: number;
  status: string;
  subtotal: string;
  accepted_at: Date | null;
  updated_at: Date | null;
  order_code: string;
  delivery_type: string;
  customer_name: string | null;
  customer_phone: string;
  item_count: number;
}

export interface StatusCountRow {
  status: string;
  count: number;
}

export interface FulfillmentDetailRow {
  id: number;
  master_order_id: number;
  shop_id: number;
  status: string;
  subtotal: string;
  accepted_at: Date | null;
  packed_at: Date | null;
  out_for_delivery_at: Date | null;
  delivered_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  updated_at: Date | null;
  order_code: string;
  delivery_type: string;
  delivery_note: string | null;
  payment_mode: string;
  trace_id: string | null;
  customer_name: string | null;
  customer_phone: string;
  address_line: string | null;
  city: string | null;
  pincode: string | null;
}

export interface FulfillmentStatusRow {
  id: number;
  status: string;
}

interface TotalRow {
  total: number;
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export interface FulfillmentListParams {
  shopId: number;
  status?: string;
  since?: string;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Repository — primary table: fulfillment
// ---------------------------------------------------------------------------

export class FulfillmentRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public async findByShop(params: FulfillmentListParams): Promise<FulfillmentListRow[]> {
    const { shopId, status, since, limit, offset } = params;
    const { where, values, idx } = this.buildWhereClause(shopId, status, since);

    const result = await this.db.query<FulfillmentListRow>(
      `SELECT
        f.id, f.status, f.subtotal, f.accepted_at, f.updated_at,
        mo.order_code, mo.delivery_type,
        c.display_name AS customer_name, c.phone AS customer_phone,
        (SELECT count(*)::int FROM order_item oi WHERE oi.fulfillment_id = f.id) AS item_count
      FROM fulfillment f
      JOIN master_order mo ON mo.id = f.master_order_id
      JOIN customer c ON c.id = mo.customer_id
      WHERE ${where}
      ORDER BY f.accepted_at DESC NULLS LAST
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    );

    return result.rows;
  }

  public async countByShop(shopId: number, status?: string, since?: string): Promise<number> {
    const { where, values } = this.buildWhereClause(shopId, status, since);

    const result = await this.db.query<TotalRow>(
      `SELECT count(*)::int AS total FROM fulfillment f WHERE ${where}`,
      values,
    );

    return result.rows[0]?.total ?? 0;
  }

  public async statusCountsByShop(shopId: number): Promise<StatusCountRow[]> {
    const result = await this.db.query<StatusCountRow>(
      `SELECT status, count(*)::int AS count
       FROM fulfillment WHERE shop_id = $1 GROUP BY status`,
      [shopId],
    );
    return result.rows;
  }

  public async findById(fulfillmentId: number, shopId: number): Promise<FulfillmentDetailRow | null> {
    const result = await this.db.query<FulfillmentDetailRow>(
      `SELECT
        f.*,
        mo.order_code, mo.delivery_type, mo.delivery_note, mo.payment_mode, mo.trace_id,
        c.display_name AS customer_name, c.phone AS customer_phone,
        a.address_line, a.city, a.pincode
      FROM fulfillment f
      JOIN master_order mo ON mo.id = f.master_order_id
      JOIN customer c ON c.id = mo.customer_id
      LEFT JOIN address a ON a.id = mo.address_id
      WHERE f.id = $1 AND f.shop_id = $2`,
      [fulfillmentId, shopId],
    );
    return result.rows[0] ?? null;
  }

  public async findStatus(fulfillmentId: number, shopId: number): Promise<FulfillmentStatusRow | null> {
    const result = await this.db.query<FulfillmentStatusRow>(
      'SELECT id, status FROM fulfillment WHERE id = $1 AND shop_id = $2',
      [fulfillmentId, shopId],
    );
    return result.rows[0] ?? null;
  }

  /** Update status within an existing transaction. */
  public async setStatus(client: PoolClient, fulfillmentId: number, shopId: number, status: string, tsCol: string): Promise<void> {
    await client.query(
      `UPDATE fulfillment
       SET status = $1, ${tsCol} = NOW(), updated_at = NOW()
       WHERE id = $2 AND shop_id = $3`,
      [status, fulfillmentId, shopId],
    );
  }

  public async recalcSubtotal(fulfillmentId: number): Promise<void> {
    await this.db.query(
      `UPDATE fulfillment
       SET subtotal = COALESCE((SELECT sum(total_price) FROM order_item WHERE fulfillment_id = $1), 0),
           updated_at = NOW()
       WHERE id = $1`,
      [fulfillmentId],
    );
  }

  private buildWhereClause(shopId: number, status?: string, since?: string) {
    const conditions: string[] = ['f.shop_id = $1'];
    const values: unknown[] = [shopId];
    let idx = 2;

    if (status) {
      conditions.push(`f.status = $${idx}`);
      values.push(status);
      idx++;
    }
    if (since) {
      conditions.push(`f.updated_at > $${idx}`);
      values.push(since);
      idx++;
    }

    return { where: conditions.join(' AND '), values, idx };
  }
}
