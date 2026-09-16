import type { ShopkeeperTransition, VisibleOrderStatus } from '@/api/types';

/**
 * The lifecycle, split by who owns each half.
 *
 *   system      placed -> accepted          (auto-accept, no human)
 *   shopkeeper  accepted -> packed -> out_for_delivery -> delivered
 *
 * `draft` and `placed` never reach the dashboard, so the visible stepper
 * starts at Accepted.
 */
export const LIFECYCLE_STEPS: Array<{ status: VisibleOrderStatus; label: string }> = [
  { status: 'accepted', label: 'Accepted' },
  { status: 'packed', label: 'Packed' },
  { status: 'out_for_delivery', label: 'Out for delivery' },
  { status: 'delivered', label: 'Delivered' },
];

const nextStep: Record<VisibleOrderStatus, ShopkeeperTransition | null> = {
  accepted: 'packed',
  packed: 'out_for_delivery',
  out_for_delivery: 'delivered',
  delivered: null,
  rejected: null,
};

const actionLabels: Record<ShopkeeperTransition, string> = {
  packed: 'Mark packed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark delivered',
};

export function nextAction(
  status: VisibleOrderStatus,
): { status: ShopkeeperTransition; label: string } | null {
  const next = nextStep[status];
  return next ? { status: next, label: actionLabels[next] } : null;
}

export function stepIndex(status: VisibleOrderStatus): number {
  return LIFECYCLE_STEPS.findIndex((step) => step.status === status);
}
