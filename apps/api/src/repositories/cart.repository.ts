import { Database } from '../lib/db';
import { PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface CartRow {
  id: number;
  customer_id: number;
}

export interface CartItemRow {
  id: number;
  cart_id: number;
  catalog_id: number;
  quantity: number;
}

export interface CartItemDetailRow {
  line_id: number;
  catalog_id: number;
  product_name: string;
  quantity: number;
  unit: string;
}

// ---------------------------------------------------------------------------
// Repository — primary tables: cart, cart_item
// ---------------------------------------------------------------------------

export class CartRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** Find existing cart or create one for this customer. Returns cart id. */
  public async findOrCreate(customerId: number): Promise<number> {
    const existing = await this.db.query<CartRow>(
      'SELECT id, customer_id FROM cart WHERE customer_id = $1',
      [customerId],
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    const created = await this.db.query<CartRow>(
      'INSERT INTO cart (customer_id) VALUES ($1) RETURNING id, customer_id',
      [customerId],
    );
    return created.rows[0].id;
  }

  /** Get all items in a cart with catalog info. */
  public async findItems(cartId: number): Promise<CartItemDetailRow[]> {
    const result = await this.db.query<CartItemDetailRow>(
      `SELECT
        ci.id AS line_id,
        ci.catalog_id,
        c.name AS product_name,
        ci.quantity,
        COALESCE(c.unit, 'unit') AS unit
      FROM cart_item ci
      JOIN catalog c ON c.id = ci.catalog_id
      WHERE ci.cart_id = $1
      ORDER BY ci.added_at ASC`,
      [cartId],
    );
    return result.rows;
  }

  /** Find a cart item by cart + catalog id. */
  public async findItemByCatalog(cartId: number, catalogId: number): Promise<CartItemRow | null> {
    const result = await this.db.query<CartItemRow>(
      'SELECT id, cart_id, catalog_id, quantity FROM cart_item WHERE cart_id = $1 AND catalog_id = $2',
      [cartId, catalogId],
    );
    return result.rows[0] ?? null;
  }

  public async addItem(cartId: number, catalogId: number, quantity: number): Promise<void> {
    await this.db.query(
      `INSERT INTO cart_item (cart_id, catalog_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, catalog_id) DO UPDATE SET quantity = cart_item.quantity + $3, added_at = NOW()`,
      [cartId, catalogId, quantity],
    );
  }

  public async setItemQuantity(cartId: number, catalogId: number, quantity: number): Promise<void> {
    await this.db.query(
      'UPDATE cart_item SET quantity = $3 WHERE cart_id = $1 AND catalog_id = $2',
      [cartId, catalogId, quantity],
    );
  }

  public async removeItem(cartId: number, catalogId: number): Promise<void> {
    await this.db.query(
      'DELETE FROM cart_item WHERE cart_id = $1 AND catalog_id = $2',
      [cartId, catalogId],
    );
  }

  public async clearCart(cartId: number): Promise<void> {
    await this.db.query('DELETE FROM cart_item WHERE cart_id = $1', [cartId]);
  }

  public async updateTimestamp(cartId: number): Promise<void> {
    await this.db.query('UPDATE cart SET updated_at = NOW() WHERE id = $1', [cartId]);
  }

  /** Delete all items within a transaction (used during order placement). */
  public async clearCartTx(client: PoolClient, cartId: number): Promise<void> {
    await client.query('DELETE FROM cart_item WHERE cart_id = $1', [cartId]);
  }
}
