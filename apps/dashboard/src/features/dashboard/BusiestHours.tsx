import type { BusiestHours as BusiestHoursData } from '@/api/types';
import { formatHour } from '@/lib/format';
import { cn } from '@/lib/cn';

/** Hours worth drawing. A 24-bar chart of a shop that opens at 7 is mostly floor. */
const FIRST_HOUR = 7;
const LAST_HOUR = 22;

/**
 * The one thing the order queue can never show: when the shop is busy.
 *
 * Bars are the hour's average over the window, so they answer "should I have
 * the bags ready before six?" rather than "what happened today" — which the
 * queue already tells you.
 */
export function BusiestHours({ data }: { data: BusiestHoursData }) {
  const hours = data.buckets.filter(
    (bucket) => bucket.hour >= FIRST_HOUR && bucket.hour <= LAST_HOUR,
  );
  const peak = Math.max(...hours.map((bucket) => bucket.average), 0);

  // With no history every bar is zero; a flat row of stubs reads as broken.
  if (peak === 0) {
    return (
      <div className="flex flex-col gap-3.5">
        <Header data={data} />
        <p className="py-10 text-center text-small text-text-muted">
          Not enough orders yet to show a pattern. This fills in over the first week.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Header data={data} />

      <div
        className="flex h-[172px] items-end gap-1 border-b border-border"
        role="img"
        aria-label={`Busiest hours, averaged over ${data.windowDays} days. Peak at ${
          data.peakHour === null ? 'no peak' : formatHour(data.peakHour)
        }.`}
      >
        {hours.map((bucket) => {
          const isPeak = bucket.hour === data.peakHour;
          return (
            <div
              key={bucket.hour}
              // A zero hour still gets 2px so the axis reads as a row of hours,
              // not a gap where data is missing.
              style={{ height: `${Math.max(2, (bucket.average / peak) * 140)}px` }}
              className={cn(
                'flex-1 rounded-t-sm',
                bucket.average === 0
                  ? 'bg-neutral-bg'
                  : isPeak
                    ? 'bg-accent-hover'
                    : 'bg-accent',
              )}
            />
          );
        })}
      </div>

      <div className="font-numeric flex justify-between text-caption tracking-normal text-text-muted">
        <span>{formatHour(FIRST_HOUR)}</span>
        <span>{formatHour(12)}</span>
        <span>{formatHour(17)}</span>
        <span>{formatHour(LAST_HOUR)}</span>
      </div>
    </div>
  );
}

function Header({ data }: { data: BusiestHoursData }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <h2 className="text-[14.5px] font-semibold">Busiest hours</h2>
      <p className="text-xs text-text-muted">
        orders per hour, averaged over the last {data.windowDays} days
      </p>
      {data.peakHour !== null ? (
        <p className="font-numeric ml-auto text-xs text-text-muted">
          Peak {formatHour(data.peakHour)}
        </p>
      ) : null}
    </div>
  );
}
