import { PoolClient } from 'pg';
import { IDatabase, CatalogSearchRow, CatalogItemRow, SubstituteRow } from '../types';

export class CatalogRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

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

    // Summed per-token match counts, not a flat "did anything match" score —
    // a single coincidental tag substring hit (e.g. "white" inside an
    // unrelated "white rice" tag) must never outrank a product whose name
    // matches nearly every token in the query. Tag hits stay weighted above
    // name hits per token, just no longer flattened to one bit.
    const tagScoreExpr = tokenParams
      .map((p) => `CASE WHEN bool_or(tag ILIKE '%' || ${p} || '%') THEN 1 ELSE 0 END`)
      .join(' + ');

    const nameScoreExpr = tokenParams
      .map((p) => `CASE WHEN name ILIKE '%' || ${p} || '%' THEN 1 ELSE 0 END`)
      .join(' + ');

    const sql = `
      WITH tag_scores AS (
        SELECT catalog_id, (${tagScoreExpr}) AS score
        FROM tag
        GROUP BY catalog_id
      ),
      name_scores AS (
        SELECT id AS catalog_id, (${nameScoreExpr}) AS score
        FROM catalog
      ),
      all_matches AS (
        SELECT catalog_id, SUM(score) AS score FROM (
          SELECT catalog_id, score * 2 AS score FROM tag_scores WHERE score > 0
          UNION ALL
          SELECT catalog_id, score FROM name_scores WHERE score > 0
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

  public async checkAvailabilityAtShop(
    catalogIds: number[],
    shopIds: number[],
  ): Promise<{ catalog_id: number; is_available: boolean; stock_quantity: number; selling_price: number }[]> {
    if (catalogIds.length === 0 || shopIds.length === 0) return [];

    const result = await this.db.query<{
      catalog_id: number;
      is_available: boolean;
      stock_quantity: number;
      selling_price: number;
    }>(
      `SELECT
        sp.catalog_id,
        bool_or(sp.is_available AND sp.stock_quantity > 0) AS is_available,
        SUM(sp.stock_quantity) AS stock_quantity,
        MIN(sp.selling_price)::float AS selling_price
      FROM shop_product sp
      WHERE sp.catalog_id = ANY($1::int[]) AND sp.shop_id = ANY($2::int[])
      GROUP BY sp.catalog_id`,
      [catalogIds, shopIds],
    );
    return result.rows;
  }

  public async findSubstitutes(
    catalogId: number,
    shopIds: number[],
    limit: number,
  ): Promise<SubstituteRow[]> {
    if (shopIds.length === 0) return [];

    const result = await this.db.query<SubstituteRow>(
      `SELECT
        c.id AS catalog_id, c.name, c.unit,
        MIN(sp.selling_price)::float AS price
      FROM catalog c
      JOIN shop_product sp ON sp.catalog_id = c.id AND sp.shop_id = ANY($2::int[])
      WHERE c.category_id = (SELECT category_id FROM catalog WHERE id = $1)
        AND c.id != $1
        AND sp.is_available = true
        AND sp.stock_quantity > 0
      GROUP BY c.id, c.name, c.unit
      ORDER BY price ASC
      LIMIT $3`,
      [catalogId, shopIds, limit],
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

  /** Find a catalog entry by name + brand (case-insensitive, brand null-safe). */
  public async findByNameAndBrandTx(
    client: PoolClient,
    name: string,
    brand: string | null,
  ): Promise<number | null> {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM catalog
       WHERE LOWER(name) = LOWER($1)
         AND (brand IS NOT DISTINCT FROM $2)
       LIMIT 1`,
      [name, brand],
    );
    return result.rows[0]?.id ?? null;
  }

  /** Insert a new catalog entry and return its id. */
  public async insertTx(
    client: PoolClient,
    name: string,
    brand: string | null,
    categoryId: number,
    unit: string | null,
    sku: string | null,
  ): Promise<number> {
    const result = await client.query<{ id: number }>(
      `INSERT INTO catalog (name, brand, category_id, unit, sku)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [name, brand, categoryId, unit, sku],
    );
    return result.rows[0].id;
  }

  public async exists(catalogId: number): Promise<boolean> {
    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM catalog WHERE id = $1',
      [catalogId],
    );
    return result.rows.length > 0;
  }

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
