import type { DashboardTransition, FulfillmentStatus } from '@/api/types';

/**
 * The lifecycle, split by who owns each half.
 *
 *   system      master_order placed -> fulfillment born `accepted`
 *   shopkeeper  accepted -> packed -> out_for_delivery -> delivered
 *
 * `draft` and `placed` live on the master order and never reach the dashboard
 * (docs/contracts.md §C2), so the visible track starts at Accepted.
 */
export const LIFECYCLE_STEPS: Array<{ status: FulfillmentStatus; label: string }> = [
  { status: 'accepted', label: 'Accepted' },
  { status: 'packed', label: 'Packed' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
];

/** Mirrors `fulfillmentTransitions` in apps/api/src/constants/index.ts. */
const nextStep: Record<FulfillmentStatus, DashboardTransition | null> = {
  accepted: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  rejected: null,
};

/**
 * A pickup order walks the same four statuses — the API's transition table has
 * no branch for it — but `out_for_delivery` means "waiting on the counter" and
 * `delivered` means "the customer took it". Only the wording differs.
 */
const actionLabels: Record<DashboardTransition, { delivery: string; pickup: string }> = {
  packed: { delivery: 'Mark packed', pickup: 'Mark packed' },
  out_for_delivery: { delivery: 'Hand to delivery', pickup: 'Ready for pickup' },
  delivered: { delivery: 'Mark delivered', pickup: 'Mark collected' },
};

export function nextAction(
  status: FulfillmentStatus,
  deliveryType?: string,
): { status: DashboardTransition; label: string } | null {
  const next = nextStep[status];
  if (!next) return null;
  return {
    status: next,
    label: actionLabels[next][deliveryType === 'pickup' ? 'pickup' : 'delivery'],
  };
}

export function stepIndex(status: FulfillmentStatus): number {
  return LIFECYCLE_STEPS.findIndex((step) => step.status === status);
}

/**
 * The API stores event types as `status_packed`, `placed`, and so on.
 * Normalise to the lifecycle vocabulary the UI already speaks.
 */
export function normaliseEventType(eventType: string): string {
  return eventType.replace(/^status_/, '');
}
