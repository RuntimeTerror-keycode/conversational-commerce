import type { VisibleOrderStatus } from '@/api/types';
import { Badge, type Tone } from '@/components/ui/Badge';

/**
 * Amber sits on `accepted`, not `placed`.
 *
 * Orders auto-accept and only become visible once they have, so `accepted` is
 * the attention state — it means "arrived, nothing done yet". `draft` and
 * `placed` never reach this component.
 */
export const statusMeta: Record<
  VisibleOrderStatus,
  { label: string; tone: Tone; solid?: boolean }
> = {
  accepted: { label: 'New', tone: 'new' },
  packed: { label: 'Packed', tone: 'packed' },
  out_for_delivery: { label: 'Out for delivery', tone: 'transit' },
  // Solid, so finished work reads as settled rather than as one more open pill.
  delivered: { label: 'Delivered', tone: 'done', solid: true },
  rejected: { label: 'Rejected', tone: 'bad' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: VisibleOrderStatus;
  className?: string;
}) {
  const meta = statusMeta[status];

  return (
    <Badge tone={meta.tone} solid={meta.solid} dot={!meta.solid} className={className}>
      {meta.label}
    </Badge>
  );
}

/** Background tint for an order's left rail, keyed to the same palette. */
export const statusRail: Record<VisibleOrderStatus, string> = {
  accepted: 'bg-new',
  packed: 'bg-packed',
  out_for_delivery: 'bg-transit',
  delivered: 'bg-done',
  rejected: 'bg-bad',
};
