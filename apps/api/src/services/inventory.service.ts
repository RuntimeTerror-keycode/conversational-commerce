import { AppError } from '../lib/app-error';
import { Logger } from '../logger/logger';
import { ShopProductRepository } from '../repositories/shop-product.repository';
import { ProductSummary, InventoryListResponse, InventoryUpdateInput } from '../types';

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
  private readonly logger: Logger;

  constructor(repo: ShopProductRepository, logger: Logger) {
    this.repo = repo;
    this.logger = logger.child('InventoryService');
  }

  public async list(query: InventoryListQuery): Promise<InventoryListResponse> {
    const { shopId, q, category, stockState, page, limit } = query;
    const offset = (page - 1) * limit;

    const [rows, total, counts] = await Promise.all([
      this.repo.findByShop({ shopId, q, category, stockState, limit, offset }),
      this.repo.countByShop(shopId, q, category, stockState),
      this.repo.stockCounts(shopId),
    ]);

    return {
      data: rows.map((row) => this.toProductSummary(row)),
      page: { page, limit, total, hasMore: offset + limit < total },
      counts,
      serverTime: new Date().toISOString(),
    };
  }

  public async update(productId: number, shopId: number, input: InventoryUpdateInput): Promise<ProductSummary> {
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
