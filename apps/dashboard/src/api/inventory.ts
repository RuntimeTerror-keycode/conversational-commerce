import { request } from './client';
import type {
  Product,
  ProductCreate,
  ProductListQuery,
  ProductListResponse,
  ProductPatch,
} from './types';

export function fetchProducts(query: ProductListQuery): Promise<ProductListResponse> {
  return request<ProductListResponse>('/inventory', {
    query: {
      q: query.q,
      category: query.category,
      stockState: query.stockState,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    },
  });
}

export function updateProduct(productId: string, patch: ProductPatch): Promise<Product> {
  return request<Product>(`/inventory/${productId}`, { method: 'PATCH', body: patch });
}

/** Managed mode only — server returns 409 read_only_inventory otherwise. */
export function createProduct(product: ProductCreate): Promise<Product> {
  return request<Product>('/inventory', { method: 'POST', body: product });
}

/** Managed mode only — soft archive per docs/frontend-contract.md Q-I5. */
export function deleteProduct(productId: string): Promise<void> {
  return request<void>(`/inventory/${productId}`, { method: 'DELETE' });
}
