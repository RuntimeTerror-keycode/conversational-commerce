import { Ban, CheckCircle2, Clock, Loader, Truck } from 'lucide-react';
import type { FulfillmentStatus } from '@/api/types';
import { Badge, type Tone } from '@/components/ui/Badge';

/**
 * DESIGN_SYSTEM.md §2's order-status badge table, mapped onto this product's
 * actual statuses. `accepted` takes the "Pending" treatment (amber, Clock) —
 * it's the attention state now, since orders auto-accept and `accepted` means
 * "arrived, nothing done yet." `draft` and `placed` never reach this component.
 */
export const statusMeta: Record<
  FulfillmentStatus,
  { label: string; tone: Tone; icon: typeof Clock; solid?: boolean }
> = {
  accepted: { label: 'New', tone: 'warning', icon: Clock },
  packed: { label: 'Packed', tone: 'info', icon: Loader },
  out_for_delivery: { label: 'Out for delivery', tone: 'violet', icon: Truck },
  // Solid, so finished work reads as settled rather than as one more open pill.
  delivered: { label: 'Delivered', tone: 'success', icon: CheckCircle2 },
  // Neutral, not red. A rejected order is not a system failure, and red is
  // reserved for actions that actually fail — see tokens.css.
  rejected: { label: 'Rejected', tone: 'neutral', icon: Ban },
};

export function StatusBadge({
  status,
  className,
}: {
  status: FulfillmentStatus;
  className?: string;
}) {
  const meta = statusMeta[status];

  return (
    <Badge tone={meta.tone} solid={meta.solid} icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  );
}

/** Background tint for an order row's left rail, keyed to the same palette. */
export const statusRail: Record<FulfillmentStatus, string> = {
  accepted: 'bg-warning',
  packed: 'bg-info',
  out_for_delivery: 'bg-violet',
  delivered: 'bg-success',
  rejected: 'bg-neutral-fg',
};
