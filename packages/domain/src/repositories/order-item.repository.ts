import { PoolClient } from 'pg';
import { IDatabase, OrderItemRow, OrderItemPriceRow, OrderItemQuantityRow } from '../types';

export class OrderItemRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findByFulfillment(fulfillmentId: number): Promise<OrderItemRow[]> {
    const result = await this.db.query<OrderItemRow>(
      `SELECT
        oi.id          AS "lineId",
        oi.shop_product_id AS "shopProductId",
        COALESCE(sp.local_name, cat.name) AS "productName",
        cat.name       AS "catalogName",
        oi.quantity,
        COALESCE(cat.unit, '') AS unit,
        oi.unit_price  AS "unitPrice",
        oi.total_price AS "lineTotal"
      FROM order_item oi
      JOIN shop_product sp ON sp.id = oi.shop_product_id
      JOIN catalog cat ON cat.id = sp.catalog_id
      WHERE oi.fulfillment_id = $1`,
      [fulfillmentId],
    );
    return result.rows;
  }

  public async findById(lineId: number, fulfillmentId: number): Promise<OrderItemPriceRow | null> {
    const result = await this.db.query<OrderItemPriceRow>(
      'SELECT id, unit_price FROM order_item WHERE id = $1 AND fulfillment_id = $2',
      [lineId, fulfillmentId],
    );
    return result.rows[0] ?? null;
  }

  public async getQuantity(lineId: number): Promise<number> {
    const result = await this.db.query<OrderItemQuantityRow>(
      'SELECT quantity FROM order_item WHERE id = $1',
      [lineId],
    );
    return result.rows[0].quantity;
  }

  public async delete(client: PoolClient, lineId: number): Promise<void> {
    await client.query('DELETE FROM order_item WHERE id = $1', [lineId]);
  }

  public async substitute(client: PoolClient, lineId: number, productId: number, unitPrice: number, totalPrice: number): Promise<void> {
    await client.query(
      `UPDATE order_item
       SET shop_product_id = $1, unit_price = $2, total_price = $3
       WHERE id = $4`,
      [productId, unitPrice, totalPrice, lineId],
    );
  }

  public async insertBatchTx(
    client: PoolClient,
    items: { fulfillmentId: number; shopProductId: number; quantity: number; unitPrice: number }[],
  ): Promise<void> {
    if (items.length === 0) return;
    const values: unknown[] = [];
    const rows: string[] = [];
    let idx = 1;
    for (const item of items) {
      rows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
      values.push(item.fulfillmentId, item.shopProductId, item.quantity, item.unitPrice, item.unitPrice * item.quantity);
      idx += 5;
    }
    await client.query(
      `INSERT INTO order_item (fulfillment_id, shop_product_id, quantity, unit_price, total_price)
       VALUES ${rows.join(', ')}`,
      values,
    );
  }

  public async updateQuantity(client: PoolClient, lineId: number, quantity: number, totalPrice: number): Promise<void> {
    await client.query(
      'UPDATE order_item SET quantity = $1, total_price = $2 WHERE id = $3',
      [quantity, totalPrice, lineId],
    );
  }
}
