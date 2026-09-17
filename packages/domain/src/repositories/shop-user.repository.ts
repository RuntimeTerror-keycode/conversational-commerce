import { IDatabase, ShopUserRow } from '../types';

export class ShopUserRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
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
        s.inventory_mode,
        to_char(s.opening_time, 'HH24:MI') AS opening_time,
        to_char(s.closing_time, 'HH24:MI') AS closing_time
      FROM shop_user su
      JOIN shop s ON s.id = su.shop_id
      WHERE su.username = $1 AND su.is_active = true`,
      [username],
    );

    return result.rows[0] ?? null;
  }
}
