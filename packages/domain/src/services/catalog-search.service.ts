import { AppError } from '../lib/app-error';
import { ILogger, DomainProduct, AvailabilityResult } from '../types';
import { CatalogRepository } from '../repositories/catalog.repository';
import { defaultSearchLimit, maxSearchLimit } from '../constants';

export class CatalogSearchService {
  private readonly catalogRepo: CatalogRepository;
  private readonly logger: ILogger;

  constructor(
    catalogRepo: CatalogRepository,
    logger: ILogger,
  ) {
    this.catalogRepo = catalogRepo;
    this.logger = logger.child('CatalogSearchService');
  }

  /** retailerId is the scoping boundary — search is always against a single shop. */
  public async searchProducts(
    retailerId: string,
    query: string,
    opts?: { attributes?: Record<string, string>; limit?: number },
  ): Promise<DomainProduct[]> {
    if (!query || query.trim().length === 0) {
      throw AppError.validation('query is required');
    }

    const shopId = parseInt(retailerId, 10);
    if (isNaN(shopId)) {
      throw AppError.validation('retailerId must be a valid number');
    }

    const limit = Math.min(opts?.limit ?? defaultSearchLimit, maxSearchLimit);
    const tokens = this.tokenize(query);

    if (tokens.length === 0) {
      return [];
    }

    const rows = await this.catalogRepo.search(tokens, [shopId], limit);

    this.logger.info('Product search', {
      retailerId,
      query,
      tokens,
      resultCount: rows.length,
    });

    return rows.map((row) => ({
      id: String(row.catalog_id),
      name: row.name,
      brand: row.brand,
      unit: row.unit ?? 'unit',
      price: row.price,
      inStock: row.in_stock,
    }));
  }

  public async checkAvailability(
    retailerId: string,
    productIds: string[],
  ): Promise<AvailabilityResult[]> {
    if (productIds.length === 0) {
      throw AppError.validation('productIds must not be empty');
    }

    const shopId = parseInt(retailerId, 10);
    if (isNaN(shopId)) {
      throw AppError.validation('retailerId must be a valid number');
    }

    const catalogIds = productIds.map((id) => {
      const n = parseInt(id, 10);
      if (isNaN(n)) throw AppError.validation(`Invalid productId: ${id}`);
      return n;
    });

    const stockRows = await this.catalogRepo.checkAvailabilityAtShop(catalogIds, shopId);
    const stockMap = new Map(stockRows.map((r) => [r.catalog_id, r]));

    const results: AvailabilityResult[] = [];

    for (const catalogId of catalogIds) {
      const stock = stockMap.get(catalogId);
      const inStock = stock ? stock.is_available && stock.stock_quantity > 0 : false;

      let substitutes: AvailabilityResult['substitutes'] = [];
      if (!inStock) {
        const subs = await this.catalogRepo.findSubstitutes(catalogId, shopId, 3);
        substitutes = subs.map((s) => ({
          id: String(s.catalog_id),
          name: s.name,
          unit: s.unit ?? 'unit',
          price: s.price,
        }));
      }

      results.push({
        productId: String(catalogId),
        inStock,
        substitutes,
      });
    }

    this.logger.info('Availability check', {
      retailerId,
      productIds,
      results: results.map((r) => ({ id: r.productId, inStock: r.inStock })),
    });

    return results;
  }

  private tokenize(query: string): string[] {
    const noise = new Set(['und', 'undo', 'venam', 'veno', 'kg', 'g', 'ml', 'l', 'litre', 'gram', 'kilo', 'pack', 'pkt', 'no']);
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !noise.has(t));
  }
}
