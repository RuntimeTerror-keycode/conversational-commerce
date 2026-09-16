import { FulfillmentStatus } from '../types';

// ---------------------------------------------------------------------------
// Fulfillment statuses
// ---------------------------------------------------------------------------

export const fulfillmentStatuses: FulfillmentStatus[] = [
  'accepted', 'packed', 'out_for_delivery', 'delivered', 'rejected',
];

/** Map from current status → the only valid next status. */
export const fulfillmentTransitions: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = {
  accepted: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
};

/** Which timestamp column to set when a fulfillment reaches a given status. */
export const fulfillmentTimestampColumn: Record<string, string> = {
  packed: 'packed_at',
  out_for_delivery: 'out_for_delivery_at',
  delivered: 'delivered_at',
};

/** Statuses the dashboard is allowed to set via PATCH. */
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
