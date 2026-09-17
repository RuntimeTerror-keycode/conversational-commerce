import {
  ArrowRightLeft,
  Check,
  CircleDot,
  MessageSquare,
  Package,
  PencilLine,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import type { FulfillmentEvent } from '@/api/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { normaliseEventType } from './lifecycle';

interface EventStyle {
  label: string;
  icon: typeof Check;
  tone: string;
}

/**
 * Keyed on the normalised event type — the API stores `status_packed` and
 * friends, which `normaliseEventType` trims to `packed`.
 */
const meta: Record<string, EventStyle> = {
  placed: {
    label: 'Order placed',
    icon: MessageSquare,
    tone: 'bg-surface-sunken text-text-secondary',
  },
  accepted: { label: 'Accepted', icon: Zap, tone: 'bg-warning-bg text-warning-fg' },
  rejected: { label: 'Rejected', icon: X, tone: 'bg-neutral-bg text-neutral-fg' },
  packed: { label: 'Packed', icon: Package, tone: 'bg-info-bg text-info-fg' },
  out_for_delivery: {
    label: 'Out for delivery',
    icon: Truck,
    tone: 'bg-violet-bg text-violet-fg',
  },
  delivered: { label: 'Delivered', icon: Check, tone: 'bg-success-bg text-success-fg' },
  line_changed: {
    label: 'Item changed',
    icon: PencilLine,
    tone: 'bg-surface-sunken text-text-secondary',
  },
  substitution: {
    label: 'Item substituted',
    icon: ArrowRightLeft,
    tone: 'bg-surface-sunken text-text-secondary',
  },
};

const actorLabels: Record<string, string> = {
  customer: 'Customer',
  retailer: 'You',
  system: 'System',
  agent: 'Assistant',
};

/**
 * `eventType` and `actor` are free-form strings on the API, so anything the
 * backend adds later still renders — with a neutral dot and a humanised label
 * rather than crashing or showing a blank row.
 */
function styleFor(eventType: string): EventStyle {
  return (
    meta[eventType] ?? {
      label: eventType.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      icon: CircleDot,
      tone: 'bg-surface-sunken text-text-secondary',
    }
  );
}

/**
 * With accept/reject gone from the UI, this feed is the main place a
 * shopkeeper sees that a decision was made for them. "Accepted · System" has
 * to be legible, not buried — so the auto-accept event keeps the amber tint it
 * has everywhere else.
 */
export function ActivityFeed({ events }: { events: FulfillmentEvent[] }) {
  const ordered = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <ol className="relative">
      {ordered.map((event, index) => {
        const style = styleFor(normaliseEventType(event.eventType));
        const Icon = style.icon;
        const last = index === ordered.length - 1;

        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!last ? (
              <span
                className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-border"
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
              <p className="text-small font-medium text-text">
                {style.label}
                {event.note ? (
                  <span className="font-normal text-text-muted"> — {event.note}</span>
                ) : null}
              </p>
              <p className="font-numeric text-caption text-text-disabled">
                {formatDateTime(event.createdAt)} ·{' '}
                {actorLabels[event.actor] ?? event.actor}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
