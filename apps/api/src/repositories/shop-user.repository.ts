import { Database } from '../lib/db';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ShopUserRow {
  user_id: number;
  username: string;
  user_name: string;
  role: string;
  shop_id: number;
  shop_name: string;
  shop_is_active: boolean;
  inventory_mode: string;
}

// ---------------------------------------------------------------------------
// Repository — primary table: shop_user
// ---------------------------------------------------------------------------

export class ShopUserRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  public async findByUsername(username: string): Promise<ShopUserRow | null> {
    const result = await this.db.query<ShopUserRow>(
      `SELECT
        su.id   AS user_id,
        su.username,
        su.name AS user_name,
        su.role,
        s.id    AS shop_id,
        s.name  AS shop_name,
        s.is_active AS shop_is_active,
        s.inventory_mode
      FROM shop_user su
      JOIN shop s ON s.id = su.shop_id
      WHERE su.username = $1 AND su.is_active = true`,
      [username],
    );

    return result.rows[0] ?? null;
  }
}
