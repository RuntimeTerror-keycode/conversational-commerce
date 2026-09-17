import type { FulfillmentListQuery, InventoryListQuery } from './types';

/** Single source of truth for cache keys, so invalidation can never miss one. */
export const queryKeys = {
  session: ['session'] as const,
  fulfillments: (query: FulfillmentListQuery) => ['fulfillments', query] as const,
  fulfillment: (id: number) => ['fulfillment', id] as const,
  inventory: (query: InventoryListQuery) => ['inventory', query] as const,
  catalogOptions: (q: string) => ['catalog-options', q] as const,
  shopSettings: ['shop-settings'] as const,
};
