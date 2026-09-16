import type { OrderListQuery, ProductListQuery } from './types';

/** Single source of truth for cache keys, so invalidation can never miss one. */
export const queryKeys = {
  session: ['session'] as const,
  orders: (query: OrderListQuery) => ['orders', query] as const,
  order: (orderId: string) => ['order', orderId] as const,
  inventory: (query: ProductListQuery) => ['inventory', query] as const,
  product: (productId: string) => ['product', productId] as const,
  stats: ['stats'] as const,
};
