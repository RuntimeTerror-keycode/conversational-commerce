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
}

export interface InventoryUpdateInput {
  sellingPrice?: number;
  inStock?: boolean;
  stockQuantity?: number;
  lowStockThreshold?: number;
}
