export const defaultSearchLimit = 3;
export const maxSearchLimit = 10;
export const confirmationTokenTtlMinutes = 5;
export const defaultEtaMinutes = 30;
export const minFulfillmentAmount = 400;

/**
 * Charged per extra store beyond the first when an order has to split.
 * Zeroed out for the demo — a split order still picks the cheapest valid
 * store combination, it just doesn't carry an extra visible charge for
 * doing so. Set back to a real value (e.g. 25) once delivery pricing is
 * actually decided.
 */
export const additionalStoreDeliveryFee = 0;

export const cartActions = ['add', 'remove', 'set'] as const;
export type CartAction = typeof cartActions[number];

export const masterOrderStatuses = ['draft', 'placed', 'accepted', 'rejected', 'delivered'] as const;
export type MasterOrderStatus = typeof masterOrderStatuses[number];
