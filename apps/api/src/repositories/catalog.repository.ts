import { Database } from '../lib/db';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export interface CatalogSearchRow {
  catalog_id: number;
  name: string;
  brand: string | null;
  unit: string | null;
  price: number;
  in_stock: boolean;
  score: number;
}

export interface CatalogItemRow {
  id: number;
  name: string;
  brand: string | null;
  unit: string | null;
  category_id: number | null;
  description: string | null;
}

export interface SubstituteRow {
  catalog_id: number;
  name: string;
  unit: string | null;
  price: number;
}

// ---------------------------------------------------------------------------
// Repository — primary tables: catalog, tag
// ---------------------------------------------------------------------------

export class CatalogRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Hybrid search: match query tokens against tag aliases (score 2)
   * and catalog name (score 1). Returns catalog-level results with
   * cheapest price across the given shops.
   */
  public async search(
    queryTokens: string[],
    shopIds: number[],
    limit: number,
  ): Promise<CatalogSearchRow[]> {
    if (queryTokens.length === 0 || shopIds.length === 0) {
      return [];
    }

    const tokenParams = queryTokens.map((_, i) => `$${i + 1}`);
    const shopParam = `$${queryTokens.length + 1}`;
    const limitParam = `$${queryTokens.length + 2}`;

    const tokenMatchClause = tokenParams
      .map((p) => `t.tag ILIKE '%' || ${p} || '%'`)
      .join(' OR ');

    const nameMatchClause = tokenParams
      .map((p) => `c.name ILIKE '%' || ${p} || '%'`)
      .join(' OR ');

    const sql = `
      WITH tag_matches AS (
        SELECT DISTINCT t.catalog_id, 2 AS score
        FROM tag t
        WHERE ${tokenMatchClause}
      ),
      name_matches AS (
        SELECT DISTINCT c.id AS catalog_id, 1 AS score
        FROM catalog c
        WHERE ${nameMatchClause}
      ),
      all_matches AS (
        SELECT catalog_id, MAX(score) AS score FROM (
          SELECT catalog_id, score FROM tag_matches
          UNION ALL
          SELECT catalog_id, score FROM name_matches
        ) combined
        GROUP BY catalog_id
      )
      SELECT
        c.id AS catalog_id,
        c.name,
        c.brand,
        c.unit,
        MIN(sp.selling_price)::float AS price,
        bool_or(sp.is_available AND sp.stock_quantity > 0) AS in_stock,
        am.score
      FROM all_matches am
      JOIN catalog c ON c.id = am.catalog_id
      JOIN shop_product sp ON sp.catalog_id = c.id AND sp.shop_id = ANY(${shopParam}::int[])
      GROUP BY c.id, c.name, c.brand, c.unit, am.score
      ORDER BY am.score DESC, c.name ASC
      LIMIT ${limitParam}
    `;

    const result = await this.db.query<CatalogSearchRow>(
      sql,
      [...queryTokens, shopIds, limit],
    );
    return result.rows;
  }

  /** Check availability of specific catalog items at a specific shop. */
  public async checkAvailabilityAtShop(
    catalogIds: number[],
    shopId: number,
  ): Promise<{ catalog_id: number; is_available: boolean; stock_quantity: number; selling_price: number }[]> {
    if (catalogIds.length === 0) return [];

    const result = await this.db.query<{
      catalog_id: number;
      is_available: boolean;
      stock_quantity: number;
      selling_price: number;
    }>(
      `SELECT
        sp.catalog_id,
        sp.is_available,
        sp.stock_quantity,
        sp.selling_price::float AS selling_price
      FROM shop_product sp
      WHERE sp.catalog_id = ANY($1::int[]) AND sp.shop_id = $2`,
      [catalogIds, shopId],
    );
    return result.rows;
  }

  /** Find substitutes in the same category at a given shop. */
  public async findSubstitutes(
    catalogId: number,
    shopId: number,
    limit: number,
  ): Promise<SubstituteRow[]> {
    const result = await this.db.query<SubstituteRow>(
      `SELECT
        c.id AS catalog_id, c.name, c.unit,
        sp.selling_price::float AS price
      FROM catalog c
      JOIN shop_product sp ON sp.catalog_id = c.id AND sp.shop_id = $2
      WHERE c.category_id = (SELECT category_id FROM catalog WHERE id = $1)
        AND c.id != $1
        AND sp.is_available = true
        AND sp.stock_quantity > 0
      ORDER BY sp.selling_price ASC
      LIMIT $3`,
      [catalogId, shopId, limit],
    );
    return result.rows;
  }

  public async findById(catalogId: number): Promise<CatalogItemRow | null> {
    const result = await this.db.query<CatalogItemRow>(
      'SELECT id, name, brand, unit, category_id, description FROM catalog WHERE id = $1',
      [catalogId],
    );
    return result.rows[0] ?? null;
  }

  /** Check that a catalog ID exists. */
  public async exists(catalogId: number): Promise<boolean> {
    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM catalog WHERE id = $1',
      [catalogId],
    );
    return result.rows.length > 0;
  }

  /** Check if any of the given shops carry this catalog item and have stock. */
  public async isAvailableAtAnyShop(catalogId: number, shopIds: number[]): Promise<boolean> {
    if (shopIds.length === 0) return false;
    const result = await this.db.query<{ found: boolean }>(
      `SELECT EXISTS(
        SELECT 1 FROM shop_product
        WHERE catalog_id = $1
          AND shop_id = ANY($2::int[])
          AND is_available = true
          AND stock_quantity > 0
      ) AS found`,
      [catalogId, shopIds],
    );
    return result.rows[0]?.found ?? false;
  }
}
