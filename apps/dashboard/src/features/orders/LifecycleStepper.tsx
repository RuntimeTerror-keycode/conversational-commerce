import { Check, Inbox, Package, Truck } from 'lucide-react';
import type { FulfillmentDetail, FulfillmentStatus } from '@/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { stepIndex } from './lifecycle';

const steps: Array<{
  status: FulfillmentStatus;
  label: string;
  icon: typeof Check;
  /** Ring + tint for the node once reached. */
  reached: string;
}> = [
  { status: 'accepted', label: 'Accepted', icon: Inbox, reached: 'border-warning bg-warning-bg text-warning-fg' },
  { status: 'packed', label: 'Packed', icon: Package, reached: 'border-info bg-info-bg text-info-fg' },
  { status: 'out_for_delivery', label: 'Out for delivery', icon: Truck, reached: 'border-violet bg-violet-bg text-violet-fg' },
  { status: 'delivered', label: 'Delivered', icon: Check, reached: 'border-success bg-success-bg text-success-fg' },
];

/**
 * Four nodes across the drawer header, with the stage labels beneath.
 *
 * Stages still to come are drawn with a **dashed** ring — the design's way of
 * saying "not yet" without spending a colour on it. Only stages actually
 * reached take their status hue, so the header reads at a glance.
 */
export function LifecycleStepper({ order }: { order: FulfillmentDetail }) {
  if (order.status === 'rejected') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-neutral-border bg-neutral-bg px-3.5 py-3">
        <span className="size-2 shrink-0 rounded-full bg-neutral-fg" aria-hidden />
        <div>
          <p className="text-body font-semibold text-neutral-fg">Rejected</p>
          {order.rejectionReason ? (
            <p className="text-caption tracking-normal text-neutral-fg/80">
              {order.rejectionReason}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const current = stepIndex(order.status);
  const times = [
    order.timeline.acceptedAt,
    order.timeline.packedAt,
    order.timeline.outForDeliveryAt,
    order.timeline.deliveredAt,
  ];

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const done = index <= current;
          const Icon = step.icon;
          const last = index === steps.length - 1;

          return (
            <li
              key={step.status}
              className={cn('flex items-center', !last && 'grow')}
            >
              <span
                className={cn(
                  'flex size-[30px] shrink-0 items-center justify-center rounded-full',
                  done
                    ? cn('border-2', step.reached)
                    : 'border-[1.5px] border-dashed border-border-strong bg-surface text-text-disabled',
                )}
              >
                <Icon className={done && index === 0 ? 'size-[15px]' : 'size-3.5'} aria-hidden />
              </span>
              {!last ? <span className="mx-2 h-0.5 grow bg-neutral-border" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      <div className="flex justify-between text-[11.5px] text-text-muted">
        {steps.map((step, index) => (
          <span
            key={step.status}
            className={cn('w-1/4', index === steps.length - 1 && 'text-right')}
          >
            {step.label}
            {times[index] ? (
              <span className="font-numeric"> {formatTime(times[index]!)}</span>
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
