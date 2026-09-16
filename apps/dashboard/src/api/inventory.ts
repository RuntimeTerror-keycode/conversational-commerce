import { request } from './client';
import type { Product, ProductListQuery, ProductListResponse, ProductPatch } from './types';

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
