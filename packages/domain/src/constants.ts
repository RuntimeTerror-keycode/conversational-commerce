export const defaultSearchLimit = 3;
export const maxSearchLimit = 10;
export const confirmationTokenTtlMinutes = 5;
export const defaultEtaMinutes = 30;
export const minFulfillmentAmount = 400;

/**
 * Charged per extra store beyond the first when an order has to split —
 * one additional real-world delivery run per extra store. Factored directly
 * into the best-value store-combination search in OrderPlacementService, so
 * a split is only ever chosen when it's still cheaper for the customer after
 * this fee, not just whenever it happens to need fewer stores.
 */
export const additionalStoreDeliveryFee = 25;

export const cartActions = ['add', 'remove', 'set'] as const;
export type CartAction = typeof cartActions[number];

export const masterOrderStatuses = ['draft', 'placed', 'accepted', 'rejected', 'delivered'] as const;
export type MasterOrderStatus = typeof masterOrderStatuses[number];
