import { PoolClient } from 'pg';
import { IDatabase, MasterOrderRow, MasterOrderInsert } from '../types';

export class MasterOrderRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async createDraft(input: MasterOrderInsert): Promise<MasterOrderRow> {
    const result = await this.db.query<MasterOrderRow>(
      `INSERT INTO master_order
        (order_code, customer_id, address_id, status,
         product_amount, total_amount, delivery_fee, platform_fee,
         confirmation_token, token_expires_at,
         confirmed_snapshot, cart_hash,
         delivery_note, trace_id)
      VALUES ($1, $2, $3, 'draft', $4, $5, 0, 0, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.orderCode,
        input.customerId,
        input.addressId,
        input.productAmount,
        input.totalAmount,
        input.confirmationToken,
        input.tokenExpiresAt,
        JSON.stringify(input.confirmedSnapshot),
        input.cartHash,
        input.deliveryNote ?? null,
        input.traceId ?? null,
      ],
    );
    return result.rows[0];
  }

  public async findByToken(token: string): Promise<MasterOrderRow | null> {
    const result = await this.db.query<MasterOrderRow>(
      `SELECT * FROM master_order
       WHERE confirmation_token = $1 AND status = 'draft'`,
      [token],
    );
    return result.rows[0] ?? null;
  }

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

  public async cleanExpiredDrafts(): Promise<number> {
    const result = await this.db.query(
      "DELETE FROM master_order WHERE status = 'draft' AND token_expires_at < NOW()",
    );
    return result.rowCount ?? 0;
  }
}
