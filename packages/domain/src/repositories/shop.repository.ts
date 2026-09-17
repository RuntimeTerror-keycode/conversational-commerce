import { IDatabase, ShopWithLocationRow } from '../types';

export class ShopRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findAllActiveWithLocation(): Promise<ShopWithLocationRow[]> {
    const result = await this.db.query<ShopWithLocationRow>(
      `SELECT
        s.id, s.name, s.is_active, s.delivery_radius_km::float AS delivery_radius_km,
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
