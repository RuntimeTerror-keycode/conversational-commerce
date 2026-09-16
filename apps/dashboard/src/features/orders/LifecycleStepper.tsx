import { Check, Zap } from 'lucide-react';
import type { Order } from '@/api/types';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { LIFECYCLE_STEPS, stepIndex } from './lifecycle';

/**
 * A continuous track with nodes on it, not four disconnected circles.
 *
 * The filled portion animates its width when a step completes, so advancing an
 * order produces visible forward movement rather than a silent repaint.
 *
 * Step one is labelled "Auto-accepted" and carries a bolt rather than a tick:
 * no person did it, and a tick would imply somebody chose to.
 */
export function LifecycleStepper({ order }: { order: Order }) {
  if (order.status === 'rejected') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-3">
        <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden />
        <div>
          <p className="text-body font-semibold text-danger-fg">Rejected</p>
          {order.rejectionReason ? (
            <p className="text-caption text-danger-fg/80">{order.rejectionReason}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const current = stepIndex(order.status);
  const timestamps = [
    order.timeline.acceptedAt,
    order.timeline.packedAt,
    order.timeline.outForDeliveryAt,
    order.timeline.deliveredAt,
  ];

  const lastIndex = LIFECYCLE_STEPS.length - 1;
  const fillPercent = (current / lastIndex) * 100;

  return (
    <div className="relative">
      {/* Track sits behind the nodes, inset by half a node so it starts and
          ends at the centres rather than at the edges of the row. */}
      <div className="absolute top-3 right-[12.5%] left-[12.5%] h-0.5 rounded-full bg-border" aria-hidden>
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      <ol className="relative flex">
        {LIFECYCLE_STEPS.map((step, index) => {
          const done = index <= current;
          const isCurrent = index === current;
          const at = timestamps[index];

          return (
            <li key={step.status} className="flex flex-1 flex-col items-center gap-2">
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                  isCurrent && order.status !== 'delivered'
                    ? 'border-accent bg-accent text-white ring-3 ring-accent-subtle'
                    : done
                      ? 'border-success bg-success text-white'
                      : 'border-border-strong bg-surface text-text-muted',
                )}
              >
                {index === 0 ? (
                  <Zap className="size-3" aria-hidden />
                ) : done ? (
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" aria-hidden />
                )}
              </span>

              <div className="px-1 text-center">
                <p
                  className={cn(
                    'text-caption font-medium',
                    done || isCurrent ? 'text-text' : 'text-text-muted',
                    isCurrent && 'font-semibold',
                  )}
                >
                  {index === 0 ? 'Auto-accepted' : step.label}
                </p>
                <p className="font-numeric text-caption tracking-normal text-text-muted">
                  {at ? formatTime(at) : '—'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
