export const defaultSearchLimit = 3;
export const maxSearchLimit = 10;
export const confirmationTokenTtlMinutes = 5;
export const defaultEtaMinutes = 30;
export const minFulfillmentAmount = 400;

export const cartActions = ['add', 'remove', 'set'] as const;
export type CartAction = typeof cartActions[number];

export const masterOrderStatuses = ['draft', 'placed', 'accepted', 'rejected', 'delivered'] as const;
export type MasterOrderStatus = typeof masterOrderStatuses[number];
