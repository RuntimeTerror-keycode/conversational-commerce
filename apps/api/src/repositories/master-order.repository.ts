import { Database } from '../lib/db';
import { PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface MasterOrderRow {
  id: number;
  order_code: string;
  customer_id: number;
  address_id: number;
  status: string;
  payment_mode: string;
  delivery_type: string;
  delivery_note: string | null;
  product_amount: string;
  total_amount: string;
  confirmation_token: string | null;
  token_expires_at: Date | null;
  trace_id: string | null;
  created_at: Date;
}

export interface MasterOrderInsert {
  orderCode: string;
  customerId: number;
  addressId: number;
  productAmount: number;
  totalAmount: number;
  confirmationToken: string;
  tokenExpiresAt: Date;
  deliveryNote?: string;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Repository — primary table: master_order
// ---------------------------------------------------------------------------

export class MasterOrderRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Create a draft order with a confirmation token. */
  public async createDraft(input: MasterOrderInsert): Promise<MasterOrderRow> {
    const result = await this.db.query<MasterOrderRow>(
      `INSERT INTO master_order
        (order_code, customer_id, address_id, status,
         product_amount, total_amount, delivery_fee, platform_fee,
         confirmation_token, token_expires_at, delivery_note, trace_id)
      VALUES ($1, $2, $3, 'draft', $4, $5, 0, 0, $6, $7, $8, $9)
      RETURNING *`,
      [
        input.orderCode,
        input.customerId,
        input.addressId,
        input.productAmount,
        input.totalAmount,
        input.confirmationToken,
        input.tokenExpiresAt,
        input.deliveryNote ?? null,
        input.traceId ?? null,
      ],
    );
    return result.rows[0];
  }

  /** Find a draft order by its confirmation token. */
  public async findByToken(token: string): Promise<MasterOrderRow | null> {
    const result = await this.db.query<MasterOrderRow>(
      `SELECT * FROM master_order
       WHERE confirmation_token = $1 AND status = 'draft'`,
      [token],
    );
    return result.rows[0] ?? null;
  }

  /** Transition draft → placed and consume the token (within transaction). */
  public async placeTx(client: PoolClient, orderId: number, deliveryNote?: string): Promise<void> {
    const sets = [
      "status = 'placed'",
      'confirmation_token = NULL',
      'updated_at = NOW()',
    ];
    const params: unknown[] = [orderId];

    if (deliveryNote !== undefined) {
      sets.push(`delivery_note = $2`);
      params.push(deliveryNote);
    }

    await client.query(
      `UPDATE master_order SET ${sets.join(', ')} WHERE id = $1`,
      params,
    );
  }

  /** Delete stale draft orders whose token has expired. */
  public async cleanExpiredDrafts(): Promise<number> {
    const result = await this.db.query(
      "DELETE FROM master_order WHERE status = 'draft' AND token_expires_at < NOW()",
    );
    return result.rowCount ?? 0;
  }
}
