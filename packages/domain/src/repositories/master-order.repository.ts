import { PoolClient } from 'pg';
import { IDatabase, MasterOrderRow, MasterOrderInsert } from '../types';
import { generateOrderCode } from '../lib/order-code';

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

  // -------------------------------------------------------------------------
  // WhatsApp session drafts — a lightweight, pre-checkout `orderId` handle.
  // Distinct from createDraft() above (which is the checkout-confirmation
  // draft, always has a confirmation_token). A session draft has
  // confirmation_token = NULL and is the row a WhatsApp orderId resolves to
  // before the customer has confirmed anything.
  // -------------------------------------------------------------------------

  public async findOpenSessionDraft(customerId: number): Promise<MasterOrderRow | null> {
    const result = await this.db.query<MasterOrderRow>(
      `SELECT * FROM master_order
       WHERE customer_id = $1 AND status = 'draft' AND confirmation_token IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [customerId],
    );
    return result.rows[0] ?? null;
  }

  public async createSessionDraft(input: {
    customerId: number;
    addressId: number;
    paymentMode: string;
  }): Promise<MasterOrderRow> {
    const orderCode = generateOrderCode();
    const result = await this.db.query<MasterOrderRow>(
      `INSERT INTO master_order (order_code, customer_id, address_id, status, payment_mode, product_amount, total_amount)
       VALUES ($1, $2, $3, 'draft', $4, 0, 0)
       RETURNING *`,
      [orderCode, input.customerId, input.addressId, input.paymentMode.toLowerCase()],
    );
    return result.rows[0];
  }

  public async updateSessionDraft(orderId: number, addressId: number, paymentMode: string): Promise<void> {
    await this.db.query(
      `UPDATE master_order SET address_id = $2, payment_mode = $3, updated_at = NOW() WHERE id = $1`,
      [orderId, addressId, paymentMode.toLowerCase()],
    );
  }

  /**
   * Attaches checkout-confirmation fields to an already-open session draft
   * (see findOpenSessionDraft) instead of inserting a second master_order row
   * for the same customer. Keeps the order_code assigned when the session
   * started.
   */
  public async attachConfirmation(
    orderId: number,
    input: Omit<MasterOrderInsert, 'orderCode' | 'customerId'>,
  ): Promise<MasterOrderRow> {
    const result = await this.db.query<MasterOrderRow>(
      `UPDATE master_order SET
        address_id = $2,
        product_amount = $3,
        total_amount = $4,
        confirmation_token = $5,
        token_expires_at = $6,
        confirmed_snapshot = $7,
        cart_hash = $8,
        delivery_note = $9,
        trace_id = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [
        orderId,
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

  public async findById(orderId: number): Promise<MasterOrderRow | null> {
    const result = await this.db.query<MasterOrderRow>(
      `SELECT * FROM master_order WHERE id = $1`,
      [orderId],
    );
    return result.rows[0] ?? null;
  }
}
