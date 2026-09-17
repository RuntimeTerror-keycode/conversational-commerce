import { FulfillmentStatus } from '../types';

// Re-export domain constants
export {
  defaultSearchLimit,
  maxSearchLimit,
  confirmationTokenTtlMinutes,
  defaultEtaMinutes,
  minFulfillmentAmount,
  cartActions,
  masterOrderStatuses,
} from '@cc/domain';
export type { CartAction, MasterOrderStatus } from '@cc/domain';

// ---------------------------------------------------------------------------
// Fulfillment statuses
// ---------------------------------------------------------------------------

export const fulfillmentStatuses: FulfillmentStatus[] = [
  'accepted', 'packed', 'out_for_delivery', 'delivered', 'rejected',
];

export const fulfillmentTransitions: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  accepted: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

export const fulfillmentTimestampColumn: Record<string, string> = {
  packed: 'packed_at',
  out_for_delivery: 'out_for_delivery_at',
  delivered: 'delivered_at',
};

export const dashboardSettableStatuses: FulfillmentStatus[] = [
  'packed', 'out_for_delivery', 'delivered',
];

// ---------------------------------------------------------------------------
// Inventory stock state filters
// ---------------------------------------------------------------------------

export const stockStateFilters = ['in_stock', 'low', 'out'] as const;
export type StockStateFilter = typeof stockStateFilters[number];

// ---------------------------------------------------------------------------
// Pagination defaults
// ---------------------------------------------------------------------------

export const defaultPageLimit = 20;
export const maxPageLimit = 100;
export const defaultInventoryLimit = 50;
