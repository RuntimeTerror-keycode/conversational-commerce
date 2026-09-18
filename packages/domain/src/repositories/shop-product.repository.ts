import { PoolClient } from 'pg';
import {
  IDatabase,
  ShopProductRow,
  ShopProductListRow,
  ShopCatalogRow,
  SubstituteProductRow,
  InventoryCounts,
  ShopProductListParams,
} from '../types';

interface TotalRow {
  total: number;
}

interface IdRow {
  id: number;
}

export class ShopProductRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  public async findByShop(params: ShopProductListParams): Promise<ShopProductListRow[]> {
    const { shopId, q, category, stockState, limit, offset } = params;
    const { where, values, idx } = this.buildWhereClause(shopId, q, category, stockState);

    const result = await this.db.query<ShopProductListRow>(
      `SELECT
        sp.id, sp.catalog_id, sp.local_name, sp.regular_price, sp.selling_price,
        sp.stock_quantity, sp.low_stock_threshold, sp.is_available, sp.updated_at,
        cat.name AS catalog_name, cat.brand, cat.unit, cat.sku,
        cg.name AS category_name
      FROM shop_product sp
      JOIN catalog cat ON cat.id = sp.catalog_id
      LEFT JOIN category cg ON cg.id = cat.category_id
      WHERE ${where}
      ORDER BY cat.name ASC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset],
    );

    return result.rows;
  }

  public async countByShop(shopId: number, q?: string, category?: string, stockState?: string): Promise<number> {
    const { where, values } = this.buildWhereClause(shopId, q, category, stockState);

    const result = await this.db.query<TotalRow>(
      `SELECT count(*)::int AS total
       FROM shop_product sp
       JOIN catalog cat ON cat.id = sp.catalog_id
       LEFT JOIN category cg ON cg.id = cat.category_id
       WHERE ${where}`,
      values,
    );

    return result.rows[0]?.total ?? 0;
  }

  public async stockCounts(shopId: number): Promise<InventoryCounts> {
    const result = await this.db.query<InventoryCounts>(
      `SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_available AND stock_quantity > low_stock_threshold)::int AS "inStock",
        count(*) FILTER (WHERE is_available AND stock_quantity > 0 AND stock_quantity <= low_stock_threshold)::int AS low,
        count(*) FILTER (WHERE NOT is_available OR stock_quantity = 0)::int AS out
      FROM shop_product WHERE shop_id = $1`,
      [shopId],
    );

    return result.rows[0] ?? { total: 0, inStock: 0, low: 0, out: 0 };
  }

  /**
   * Every category this shop actually stocks, so the dashboard's filter
   * dropdown can list them. Derived from the shop's own rows rather than the
   * whole category table — offering "Dairy" to a shop that sells no dairy is
   * a filter that can only ever return nothing.
   */
  public async categoriesForShop(shopId: number): Promise<string[]> {
    const result = await this.db.query<{ name: string }>(
      `SELECT DISTINCT cg.name
       FROM shop_product sp
       JOIN catalog cat ON cat.id = sp.catalog_id
       JOIN category cg ON cg.id = cat.category_id
       WHERE sp.shop_id = $1
       ORDER BY cg.name`,
      [shopId],
    );

    return result.rows.map((row) => row.name);
  }

  public async exists(productId: number, shopId: number): Promise<boolean> {
    const result = await this.db.query<IdRow>(
      'SELECT id FROM shop_product WHERE id = $1 AND shop_id = $2',
      [productId, shopId],
    );
    return result.rows.length > 0;
  }

  public async findForSubstitute(productId: number, shopId: number): Promise<SubstituteProductRow | null> {
    const result = await this.db.query<SubstituteProductRow>(
      'SELECT id, selling_price, local_name FROM shop_product WHERE id = $1 AND shop_id = $2',
      [productId, shopId],
    );
    return result.rows[0] ?? null;
  }

  public async update(productId: number, shopId: number, sets: string[], params: unknown[]): Promise<ShopProductRow> {
    const idx = params.length + 1;
    params.push(productId, shopId);

    const result = await this.db.query<ShopProductRow>(
      `UPDATE shop_product
       SET ${sets.join(', ')}
       WHERE id = $${idx} AND shop_id = $${idx + 1}
       RETURNING *`,
      params,
    );

    return result.rows[0];
  }

  /** Catalogue search for the "add product" picker. */
  public async searchCatalog(shopId: number, q: string | undefined, limit: number) {
    const params: unknown[] = [shopId];
    let where = '';

    if (q) {
      params.push(q);
      where = `WHERE (cat.name ILIKE '%' || $2 || '%'
                 OR cat.brand ILIKE '%' || $2 || '%'
                 OR cat.sku ILIKE '%' || $2 || '%')`;
    }

    params.push(limit);

    const result = await this.db.query<{
      catalog_id: number;
      name: string;
      brand: string | null;
      category: string | null;
      unit: string | null;
      sku: string | null;
      already_stocked: boolean;
    }>(
      `SELECT cat.id AS catalog_id, cat.name, cat.brand, cg.name AS category,
              cat.unit, cat.sku,
              EXISTS (
                SELECT 1 FROM shop_product sp
                WHERE sp.shop_id = $1 AND sp.catalog_id = cat.id
              ) AS already_stocked
       FROM catalog cat
       LEFT JOIN category cg ON cg.id = cat.category_id
       ${where}
       ORDER BY cat.name
       LIMIT $${params.length}`,
      params,
    );

    return result.rows;
  }

  public async insertForShop(
    shopId: number,
    catalogId: number,
    values: {
      localName: string | null;
      regularPrice: number;
      sellingPrice: number;
      stockQuantity: number;
      lowStockThreshold: number;
    },
  ): Promise<number> {
    const result = await this.db.query<{ id: number }>(
      `INSERT INTO shop_product
         (shop_id, catalog_id, local_name, regular_price, selling_price,
          stock_quantity, low_stock_threshold, is_available, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $6 > 0, NOW())
       RETURNING id`,
      [
        shopId,
        catalogId,
        values.localName,
        values.regularPrice,
        values.sellingPrice,
        values.stockQuantity,
        values.lowStockThreshold,
      ],
    );

    return result.rows[0].id;
  }

  /** How many historical order lines reference this product. */
  public async orderLineCount(productId: number): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM order_item WHERE shop_product_id = $1',
      [productId],
    );

    return parseInt(result.rows[0].count, 10);
  }

  public async deleteForShop(productId: number, shopId: number): Promise<void> {
    await this.db.query('DELETE FROM shop_product WHERE id = $1 AND shop_id = $2', [
      productId,
      shopId,
    ]);
  }

  public async findCatalog(catalogId: number): Promise<ShopCatalogRow> {
    const result = await this.db.query<ShopCatalogRow>(
      `SELECT cat.name, cat.brand, cat.unit, cat.sku, cg.name AS category_name
       FROM catalog cat
       LEFT JOIN category cg ON cg.id = cat.category_id
       WHERE cat.id = $1`,
      [catalogId],
    );
    return result.rows[0];
  }

  public async cheapestPrices(
    catalogIds: number[],
    shopIds: number[],
  ): Promise<{ catalog_id: number; price: number }[]> {
    if (catalogIds.length === 0 || shopIds.length === 0) return [];
    const result = await this.db.query<{ catalog_id: number; price: number }>(
      `SELECT catalog_id, MIN(selling_price)::float AS price
       FROM shop_product
       WHERE catalog_id = ANY($1::int[])
         AND shop_id = ANY($2::int[])
         AND is_available = true
         AND stock_quantity > 0
       GROUP BY catalog_id`,
      [catalogIds, shopIds],
    );
    return result.rows;
  }

  public async findByCatalogAndShop(
    catalogId: number,
    shopId: number,
  ): Promise<{ id: number; selling_price: string; is_available: boolean; stock_quantity: number } | null> {
    const result = await this.db.query<{
      id: number; selling_price: string; is_available: boolean; stock_quantity: number;
    }>(
      `SELECT id, selling_price, is_available, stock_quantity
       FROM shop_product
       WHERE catalog_id = $1 AND shop_id = $2`,
      [catalogId, shopId],
    );
    return result.rows[0] ?? null;
  }

  /** Insert or update a shop_product row keyed on (shop_id, catalog_id). */
  public async upsertTx(
    client: PoolClient,
    shopId: number,
    catalogId: number,
    regularPrice: number,
    sellingPrice: number,
    stockQuantity: number,
    isAvailable: boolean,
  ): Promise<void> {
    await client.query(
      `INSERT INTO shop_product (shop_id, catalog_id, regular_price, selling_price, stock_quantity, is_available, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (shop_id, catalog_id) DO UPDATE SET
         regular_price  = EXCLUDED.regular_price,
         selling_price  = EXCLUDED.selling_price,
         stock_quantity = EXCLUDED.stock_quantity,
         is_available   = EXCLUDED.is_available,
         updated_at     = NOW()`,
      [shopId, catalogId, regularPrice, sellingPrice, stockQuantity, isAvailable],
    );
  }

  /**
   * Mark every shop_product for this shop that is NOT in the given catalog_id
   * set as unavailable (stock 0). Used after a full-state inventory sync so
   * products absent from the push don't linger as available.
   */
  public async markStaleUnavailableTx(
    client: PoolClient,
    shopId: number,
    freshCatalogIds: number[],
  ): Promise<number> {
    if (freshCatalogIds.length === 0) return 0;

    const result = await client.query<{ count: number }>(
      `UPDATE shop_product
       SET is_available = false, stock_quantity = 0, updated_at = NOW()
       WHERE shop_id = $1
         AND catalog_id != ALL($2::int[])
         AND is_available = true
       RETURNING id`,
      [shopId, freshCatalogIds],
    );
    return result.rowCount ?? 0;
  }

  /**
   * Decrements stock on order placement (docs/contracts.md Q-I1: fires at
   * order time, since auto-accept is immediate). Clamped at 0 rather than
   * going negative, and flips is_available false at zero (Q-I2) — a
   * concurrent second order for the last unit can't oversell past it.
   */
  public async decrementStockTx(client: PoolClient, shopProductId: number, quantity: number): Promise<void> {
    await client.query(
      `UPDATE shop_product
       SET stock_quantity = GREATEST(stock_quantity - $2, 0),
           is_available = (GREATEST(stock_quantity - $2, 0) > 0),
           updated_at = NOW()
       WHERE id = $1`,
      [shopProductId, quantity],
    );
  }

  private buildWhereClause(shopId: number, q?: string, category?: string, stockState?: string) {
    const conditions: string[] = ['sp.shop_id = $1'];
    const values: unknown[] = [shopId];
    let idx = 2;

    if (q) {
      conditions.push(
        `(cat.name ILIKE '%' || $${idx} || '%'
          OR sp.local_name ILIKE '%' || $${idx} || '%'
          OR cat.brand ILIKE '%' || $${idx} || '%'
          OR cat.sku ILIKE '%' || $${idx} || '%')`,
      );
      values.push(q);
      idx++;
    }

    if (category) {
      conditions.push(`cg.name = $${idx}`);
      values.push(category);
      idx++;
    }

    if (stockState === 'in_stock') {
      conditions.push('sp.is_available = true AND sp.stock_quantity > sp.low_stock_threshold');
    } else if (stockState === 'low') {
      conditions.push('sp.is_available = true AND sp.stock_quantity > 0 AND sp.stock_quantity <= sp.low_stock_threshold');
    } else if (stockState === 'out') {
      conditions.push('(sp.is_available = false OR sp.stock_quantity = 0)');
    }

    return { where: conditions.join(' AND '), values, idx };
  }
}
