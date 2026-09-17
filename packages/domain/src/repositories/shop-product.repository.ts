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
