import { request } from './client';
import type {
  CatalogItem,
  InventoryCreateInput,
  InventoryListQuery,
  InventoryListResponse,
  InventoryUpdateInput,
  Product,
} from './types';

export function fetchProducts(
  query: InventoryListQuery,
): Promise<InventoryListResponse> {
  return request<InventoryListResponse>('/inventory', {
    query: {
      q: query.q,
      category: query.category,
      stockState: query.stockState,
      page: query.page,
      limit: query.limit,
    },
  });
}

export function updateProduct(
  id: number,
  patch: InventoryUpdateInput,
): Promise<Product> {
  return request<Product>(`/inventory/${id}`, { method: 'PATCH', body: patch });
}

/** Catalogue items this shop could stock. */
export async function fetchCatalogOptions(q: string, limit = 25): Promise<CatalogItem[]> {
  const result = await request<{ data: CatalogItem[] }>('/inventory/catalog', {
    query: { q: q || undefined, limit },
  });
  return result.data;
}

export function createProduct(input: InventoryCreateInput): Promise<Product> {
  return request<Product>('/inventory', { method: 'POST', body: input });
}
