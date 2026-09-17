import { IDatabase } from '../types';
import { CustomerRow, CustomerWithAddressRow } from '../types';

export class CustomerRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findByPhone(phone: string): Promise<CustomerRow | null> {
    const result = await this.db.query<CustomerRow>(
      'SELECT id, phone, display_name, language, default_payment_mode FROM customer WHERE phone = $1',
      [phone],
    );
    return result.rows[0] ?? null;
  }

  public async findById(customerId: number): Promise<CustomerRow | null> {
    const result = await this.db.query<CustomerRow>(
      'SELECT id, phone, display_name, language, default_payment_mode FROM customer WHERE id = $1',
      [customerId],
    );
    return result.rows[0] ?? null;
  }

  public async findWithDefaultAddress(phone: string): Promise<CustomerWithAddressRow | null> {
    const result = await this.db.query<CustomerWithAddressRow>(
      `SELECT
        c.id, c.phone, c.display_name, c.language, c.default_payment_mode,
        a.id AS address_id,
        a.address_line,
        a.label,
        a.latitude::float AS latitude,
        a.longitude::float AS longitude,
        a.city
      FROM customer c
      LEFT JOIN customer_address ca
        ON ca.customer_id = c.id AND ca.is_default = true
      LEFT JOIN address a
        ON a.id = ca.address_id
      WHERE c.phone = $1`,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  public async findOrCreateByPhone(phone: string): Promise<CustomerRow> {
    const result = await this.db.query<CustomerRow>(
      `INSERT INTO customer (phone) VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone, display_name, language, default_payment_mode`,
      [phone],
    );
    return result.rows[0];
  }

  public async setDefaultPaymentMode(customerId: number, mode: string): Promise<void> {
    await this.db.query('UPDATE customer SET default_payment_mode = $2 WHERE id = $1', [customerId, mode]);
  }

  /**
   * Upserts the customer's default address. Coordinates are optional — a
   * plain-text address typed in chat has none, and a WhatsApp session with a
   * real location share does. Omitted fields keep whatever was there before.
   */
  public async upsertDefaultAddress(
    customerId: number,
    input: { addressLine?: string; latitude?: number | null; longitude?: number | null },
  ): Promise<number> {
    const existing = await this.db.query<{ address_id: number }>(
      `SELECT a.id AS address_id
       FROM customer_address ca
       JOIN address a ON a.id = ca.address_id
       WHERE ca.customer_id = $1 AND ca.is_default = true`,
      [customerId],
    );

    if (existing.rows[0]) {
      await this.db.query(
        `UPDATE address
         SET address_line = COALESCE($2, address_line),
             latitude = COALESCE($3, latitude),
             longitude = COALESCE($4, longitude)
         WHERE id = $1`,
        [existing.rows[0].address_id, input.addressLine ?? null, input.latitude ?? null, input.longitude ?? null],
      );
      return existing.rows[0].address_id;
    }

    const created = await this.db.query<{ id: number }>(
      `INSERT INTO address (address_line, latitude, longitude) VALUES ($1, $2, $3) RETURNING id`,
      [input.addressLine ?? null, input.latitude ?? null, input.longitude ?? null],
    );
    await this.db.query(
      `INSERT INTO customer_address (customer_id, address_id, address_type, is_default)
       VALUES ($1, $2, 'home', true)`,
      [customerId, created.rows[0].id],
    );
    return created.rows[0].id;
  }
}
