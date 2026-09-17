import { IDatabase } from '../types';
import { CustomerRow, CustomerWithAddressRow } from '../types';

export class CustomerRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findByPhone(phone: string): Promise<CustomerRow | null> {
    const result = await this.db.query<CustomerRow>(
      'SELECT id, phone, display_name, language FROM customer WHERE phone = $1',
      [phone],
    );
    return result.rows[0] ?? null;
  }

  public async findWithDefaultAddress(phone: string): Promise<CustomerWithAddressRow | null> {
    const result = await this.db.query<CustomerWithAddressRow>(
      `SELECT
        c.id, c.phone, c.display_name, c.language,
        a.id AS address_id,
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
}
