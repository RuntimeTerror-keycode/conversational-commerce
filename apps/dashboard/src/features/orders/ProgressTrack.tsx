import { Fragment } from 'react';
import type { FulfillmentStatus } from '@/api/types';
import { cn } from '@/lib/cn';
import { stepIndex } from './lifecycle';

/**
 * Four dots and three segments, filled up to the order's current stage.
 *
 * It answers "how far along is this one?" without the reader parsing a word,
 * which is what makes a column of thirty rows scannable. The badge still
 * carries the status in text — this is a second signal, never the only one.
 */
const fill: Record<FulfillmentStatus, string> = {
  accepted: 'bg-warning',
  packed: 'bg-info',
  out_for_delivery: 'bg-violet',
  delivered: 'bg-success',
  rejected: 'bg-neutral-fg',
};

const ring: Record<FulfillmentStatus, string> = {
  accepted: 'border-warning',
  packed: 'border-info',
  out_for_delivery: 'border-violet',
  delivered: 'border-success',
  rejected: 'border-neutral-fg',
};

export function ProgressTrack({ status }: { status: FulfillmentStatus }) {
  // `rejected` never reached a stage — show an empty track rather than
  // implying progress that did not happen.
  const reached = status === 'rejected' ? -1 : stepIndex(status);

  return (
    // The connectors stretch so the rail fills its column edge to edge, rather
    // than sitting in the left third of it with dead space after.
    <div className="flex items-center gap-[5px]" aria-hidden>
      {[0, 1, 2, 3].map((node) => (
        <Fragment key={node}>
          {node > 0 ? (
            <span
              className={cn(
                'h-0.5 min-w-4 flex-1',
                node <= reached ? fill[status] : 'bg-neutral-border',
              )}
            />
          ) : null}
          <span
            className={cn(
              'size-2.5 shrink-0 rounded-full border-[1.5px]',
              node <= reached
                ? cn(fill[status], ring[status])
                : 'border-border-strong bg-surface',
            )}
          />
        </Fragment>
      ))}
    </div>
  );
}
