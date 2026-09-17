import { PaginatedResponse } from './index';
import { InventoryCounts } from '@cc/domain';

export { InventoryCounts } from '@cc/domain';

export interface ProductSummary {
  id: number;
  name: string;
  localName: string | null;
  brand: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  regularPrice: number;
  sellingPrice: number;
  inStock: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isLow: boolean;
  updatedAt: string | null;
}

export interface InventoryListResponse extends PaginatedResponse<ProductSummary> {
  counts: InventoryCounts;
  /** Categories this shop stocks — populates the filter dropdown. */
  categories: string[];
}

export interface InventoryUpdateInput {
  sellingPrice?: number;
  inStock?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

/** A shared-catalogue item the shop has not stocked yet. */
export interface CatalogItem {
  catalogId: number;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  /** True when this shop already stocks it — such rows cannot be added twice. */
  alreadyStocked: boolean;
}

/** POST /api/inventory — stock a catalogue item in this shop. */
export interface InventoryCreateInput {
  catalogId: number;
  sellingPrice: number;
  regularPrice?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  localName?: string | null;
}
