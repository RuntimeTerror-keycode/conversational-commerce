import { Database } from '../lib/db';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface ShopWithLocationRow {
  id: number;
  name: string;
  is_active: boolean;
  delivery_radius_km: number | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
}

// ---------------------------------------------------------------------------
// Repository — primary table: shop
// ---------------------------------------------------------------------------

export class ShopRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /** All active shops with their geocoded address. */
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
