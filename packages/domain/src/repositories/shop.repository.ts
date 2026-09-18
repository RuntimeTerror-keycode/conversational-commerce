import { IDatabase, ShopSettingsRow, ShopWithLocationRow } from '../types';

export class ShopRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findAllActiveWithLocation(): Promise<ShopWithLocationRow[]> {
    const result = await this.db.query<ShopWithLocationRow>(
      `SELECT
        s.id, s.name, s.is_active, s.delivery_radius_km::float AS delivery_radius_km,
        to_char(s.opening_time, 'HH24:MI') AS opening_time,
        to_char(s.closing_time, 'HH24:MI') AS closing_time,
        a.latitude::float AS latitude,
        a.longitude::float AS longitude,
        a.city
      FROM shop s
      LEFT JOIN shop_address sa ON sa.shop_id = s.id
      LEFT JOIN address a ON a.id = sa.address_id
      WHERE s.is_active = true`,
    );
    return result.rows;
  }

  /**
   * The shop's editable settings, times pre-formatted as "HH:MM".
   *
   * Separate from findById, which answers a different question — that one is
   * about where the shop is, for retailer resolution.
   */
  public async findSettings(shopId: number): Promise<ShopSettingsRow | null> {
    const result = await this.db.query<ShopSettingsRow>(
      `SELECT id, name, owner_name, phone,
              to_char(opening_time, 'HH24:MI') AS opening_time,
              to_char(closing_time, 'HH24:MI') AS closing_time,
              is_active, inventory_mode, delivery_radius_km
       FROM shop WHERE id = $1`,
      [shopId],
    );
    return result.rows[0] ?? null;
  }

  public async updateSettings(
    shopId: number,
    sets: string[],
    params: unknown[],
  ): Promise<ShopSettingsRow> {
    const result = await this.db.query<ShopSettingsRow>(
      `UPDATE shop SET ${sets.join(', ')} WHERE id = $${params.length + 1}
       RETURNING id, name, owner_name, phone,
                 to_char(opening_time, 'HH24:MI') AS opening_time,
                 to_char(closing_time, 'HH24:MI') AS closing_time,
                 is_active, inventory_mode, delivery_radius_km`,
      [...params, shopId],
    );
    return result.rows[0];
  }

  public async findById(shopId: number): Promise<ShopWithLocationRow | null> {
    const result = await this.db.query<ShopWithLocationRow>(
      `SELECT
        s.id, s.name, s.is_active, s.delivery_radius_km::float AS delivery_radius_km,
        a.latitude::float AS latitude,
        a.longitude::float AS longitude,
        a.city
      FROM shop s
      LEFT JOIN shop_address sa ON sa.shop_id = s.id
      LEFT JOIN address a ON a.id = sa.address_id
      WHERE s.id = $1`,
      [shopId],
    );
    return result.rows[0] ?? null;
  }
}
