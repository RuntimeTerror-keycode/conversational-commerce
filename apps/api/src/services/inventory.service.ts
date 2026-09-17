import { AppError, ShopProductRepository, ShopRepository } from '@cc/domain';
import { Logger } from '../logger/logger';
import { isManagedInventory } from '../constants';
import {
  CatalogItem,
  InventoryCreateInput,
  InventoryListResponse,
  InventoryUpdateInput,
  ProductSummary,
} from '../types';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface InventoryListQuery {
  shopId: number;
  q?: string;
  category?: string;
  stockState?: string;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InventoryService {
  private readonly repo: ShopProductRepository;
  private readonly shopRepo: ShopRepository;
  private readonly logger: Logger;

  constructor(repo: ShopProductRepository, shopRepo: ShopRepository, logger: Logger) {
    this.repo = repo;
    this.shopRepo = shopRepo;
    this.logger = logger.child('InventoryService');
  }

  /**
   * Only shops whose inventory we manage may write to it.
   *
   * A `synced` shop runs its own POS; our rows are a copy, so a write here
   * would be silently overwritten by the next sync — and worse, would disagree
   * with the shop's real stock in the meantime.
   *
   * This must live server-side. The dashboard hides the controls, but hiding a
   * button is not a permission — the check has to be here or it does not exist.
   */
  private async assertManaged(shopId: number): Promise<void> {
    const shop = await this.shopRepo.findSettings(shopId);
    if (!shop) throw AppError.notFound('Shop not found');

    if (!isManagedInventory(shop.inventory_mode)) {
      throw AppError.forbidden(
        'This inventory syncs from your billing system and cannot be edited here',
      );
    }
  }

  public async list(query: InventoryListQuery): Promise<InventoryListResponse> {
    const { shopId, q, category, stockState, page, limit } = query;
    const offset = (page - 1) * limit;

    const [rows, total, counts, categories] = await Promise.all([
      this.repo.findByShop({ shopId, q, category, stockState, limit, offset }),
      this.repo.countByShop(shopId, q, category, stockState),
      this.repo.stockCounts(shopId),
      this.repo.categoriesForShop(shopId),
    ]);

    return {
      data: rows.map((row) => this.toProductSummary(row)),
      page: { page, limit, total, hasMore: offset + limit < total },
      counts,
      categories,
      serverTime: new Date().toISOString(),
    };
  }

  /** Catalogue picker for adding a product to this shop. */
  public async catalogOptions(
    shopId: number,
    q: string | undefined,
    limit: number,
  ): Promise<CatalogItem[]> {
    const rows = await this.repo.searchCatalog(shopId, q, limit);

    return rows.map((row) => ({
      catalogId: row.catalog_id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      unit: row.unit,
      sku: row.sku,
      alreadyStocked: row.already_stocked,
    }));
  }

  public async create(shopId: number, input: InventoryCreateInput): Promise<ProductSummary> {
    await this.assertManaged(shopId);

    if (!Number.isInteger(input?.catalogId)) {
      throw AppError.validation('catalogId is required');
    }
    if (typeof input.sellingPrice !== 'number' || input.sellingPrice < 0) {
      throw AppError.validation('sellingPrice must be a non-negative number');
    }

    const stockQuantity = input.stockQuantity ?? 0;
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      throw AppError.validation('stockQuantity must be a non-negative integer');
    }

    const lowStockThreshold = input.lowStockThreshold ?? 5;
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      throw AppError.validation('lowStockThreshold must be a non-negative integer');
    }

    // Fails loudly rather than inserting a row pointing at nothing.
    await this.repo.findCatalog(input.catalogId);

    let productId: number;
    try {
      productId = await this.repo.insertForShop(shopId, input.catalogId, {
        localName: input.localName ?? null,
        // Falls back to the selling price so a shop that does not track an RRP
        // still gets a sane value rather than zero.
        regularPrice: input.regularPrice ?? input.sellingPrice,
        sellingPrice: input.sellingPrice,
        stockQuantity,
        lowStockThreshold,
      });
    } catch (error) {
      // UNIQUE(shop_id, catalog_id) — the shop already stocks this item.
      if ((error as { code?: string })?.code === '23505') {
        throw AppError.conflict('This shop already stocks that product');
      }
      throw error;
    }

    this.logger.info('Product added to shop', {
      shopId, productId, catalogId: input.catalogId,
    });
    return this.findOne(productId, shopId);
  }

  /**
   * Removed only when nothing references it.
   *
   * There is no archive flag on `shop_product`, and a hard delete would orphan
   * the order lines that point at it — historical orders must still resolve
   * their product names. So a product that has ever been ordered is refused
   * with a 409 telling the shopkeeper to mark it unavailable instead, which
   * achieves the same outcome for customers.
   */
  public async remove(productId: number, shopId: number): Promise<void> {
    await this.assertManaged(shopId);

    const exists = await this.repo.exists(productId, shopId);
    if (!exists) {
      throw AppError.notFound('Product not found in this shop');
    }

    const referenced = await this.repo.orderLineCount(productId);
    if (referenced > 0) {
      throw AppError.conflict(
        'This product appears in past orders and cannot be deleted. Mark it unavailable instead.',
        { orderLines: referenced },
      );
    }

    await this.repo.deleteForShop(productId, shopId);
    this.logger.info('Product removed from shop', { shopId, productId });
  }

  /** Single product, in the same shape the list returns. */
  private async findOne(productId: number, shopId: number): Promise<ProductSummary> {
    const rows = await this.repo.findByShop({ shopId, limit: 1000, offset: 0 });
    const row = rows.find((candidate) => candidate.id === productId);
    if (!row) throw AppError.notFound('Product not found in this shop');
    return this.toProductSummary(row);
  }

  public async update(productId: number, shopId: number, input: InventoryUpdateInput): Promise<ProductSummary> {
    await this.assertManaged(shopId);

    const exists = await this.repo.exists(productId, shopId);
    if (!exists) {
      throw AppError.notFound('Product not found in this shop');
    }

    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let idx = 1;

    if (input.sellingPrice !== undefined) {
      if (typeof input.sellingPrice !== 'number' || input.sellingPrice < 0) {
        throw AppError.validation('sellingPrice must be a non-negative number');
      }
      sets.push(`selling_price = $${idx}`);
      params.push(input.sellingPrice);
      idx++;
    }

    if (input.inStock !== undefined) {
      if (typeof input.inStock !== 'boolean') {
        throw AppError.validation('inStock must be a boolean');
      }
      sets.push(`is_available = $${idx}`);
      params.push(input.inStock);
      idx++;
    }

    if (input.stockQuantity !== undefined) {
      if (!Number.isInteger(input.stockQuantity) || input.stockQuantity < 0) {
        throw AppError.validation('stockQuantity must be a non-negative integer');
      }
      sets.push(`stock_quantity = $${idx}`);
      params.push(input.stockQuantity);
      idx++;
    }

    if (input.lowStockThreshold !== undefined) {
      if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0) {
        throw AppError.validation('lowStockThreshold must be a non-negative integer');
      }
      sets.push(`low_stock_threshold = $${idx}`);
      params.push(input.lowStockThreshold);
      idx++;
    }

    if (params.length === 0) {
      throw AppError.validation('No fields to update');
    }

    const row = await this.repo.update(productId, shopId, sets, params);
    const cat = await this.repo.findCatalog(row.catalog_id);

    this.logger.info('Product updated', { productId, shopId });

    return {
      id: row.id,
      name: cat.name,
      localName: row.local_name,
      brand: cat.brand,
      category: cat.category_name,
      unit: cat.unit,
      sku: cat.sku,
      regularPrice: parseFloat(row.regular_price),
      sellingPrice: parseFloat(row.selling_price),
      inStock: row.is_available,
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      isLow: row.is_available && row.stock_quantity > 0 && row.stock_quantity <= row.low_stock_threshold,
      updatedAt: row.updated_at?.toISOString() ?? null,
    };
  }

  private toProductSummary(row: {
    id: number;
    catalog_name: string;
    local_name: string | null;
    brand: string | null;
    category_name: string | null;
    unit: string | null;
    sku: string | null;
    regular_price: string;
    selling_price: string;
    is_available: boolean;
    stock_quantity: number;
    low_stock_threshold: number;
    updated_at: Date | null;
  }): ProductSummary {
    return {
      id: row.id,
      name: row.catalog_name,
      localName: row.local_name,
      brand: row.brand,
      category: row.category_name,
      unit: row.unit,
      sku: row.sku,
      regularPrice: parseFloat(row.regular_price),
      sellingPrice: parseFloat(row.selling_price),
      inStock: row.is_available,
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      isLow: row.is_available && row.stock_quantity > 0 && row.stock_quantity <= row.low_stock_threshold,
      updatedAt: row.updated_at?.toISOString() ?? null,
    };
  }
}
