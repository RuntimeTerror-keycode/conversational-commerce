import {
  ArrowRightLeft,
  Check,
  MessageSquare,
  Package,
  PencilLine,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import type { OrderEvent } from '@/api/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';

const meta: Record<
  OrderEvent['type'],
  { label: string; icon: typeof Check; tone: string }
> = {
  placed: { label: 'Order placed', icon: MessageSquare, tone: 'bg-sunk text-ink-2' },
  accepted: { label: 'Accepted', icon: Zap, tone: 'bg-new-soft text-new-ink' },
  rejected: { label: 'Rejected', icon: X, tone: 'bg-bad-soft text-bad' },
  packed: { label: 'Packed', icon: Package, tone: 'bg-packed-soft text-packed' },
  out_for_delivery: {
    label: 'Out for delivery',
    icon: Truck,
    tone: 'bg-transit-soft text-transit',
  },
  delivered: { label: 'Delivered', icon: Check, tone: 'bg-done-soft text-done' },
  line_changed: { label: 'Item changed', icon: PencilLine, tone: 'bg-sunk text-ink-2' },
  substitution: {
    label: 'Item substituted',
    icon: ArrowRightLeft,
    tone: 'bg-sunk text-ink-2',
  },
};

const actorLabels: Record<OrderEvent['actor'], string> = {
  customer: 'Customer',
  retailer: 'You',
  system: 'System',
  agent: 'Assistant',
};

/**
 * With accept/reject gone from the UI, this feed is the main place a
 * shopkeeper sees that a decision was made for them. "Accepted · System" has
 * to be legible, not buried — so the auto-accept event keeps the amber tint it
 * has everywhere else.
 */
export function ActivityFeed({ events }: { events: OrderEvent[] }) {
  const ordered = [...events].reverse();

  return (
    <ol className="relative">
      {ordered.map((event, index) => {
        const style = meta[event.type];
        const Icon = style.icon;
        const last = index === ordered.length - 1;

        return (
          <li key={`${event.at}-${event.type}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-line"
                aria-hidden
              />
            ) : null}

            <span
              className={cn(
                'relative flex size-6 shrink-0 items-center justify-center rounded-full',
                style.tone,
              )}
            >
              <Icon className="size-3" aria-hidden />
            </span>

            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium text-ink">
                {style.label}
                {event.note ? (
                  <span className="font-normal text-ink-3"> — {event.note}</span>
                ) : null}
              </p>
              <p className="tnum text-xs text-ink-4">
                {formatDateTime(event.at)} · {actorLabels[event.actor]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
