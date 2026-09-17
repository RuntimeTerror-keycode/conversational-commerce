import { cn } from '@/lib/cn';

export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Tints the count pill clay — used so "New" stays the loud one. */
  tone?: 'attention' | 'neutral';
}

interface SegmentedProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A sliding pill on an inset track. Geometry from the design canvas:
 * 3px track padding, 36px tall segments, radius 6 inside a radius-8 track.
 *
 * The active segment is a raised white chip with a hairline; inactive ones are
 * transparent. Only the attention count gets a filled pill — the rest are
 * plain tabular figures, so one number is loud and the others are just facts.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex self-start items-center gap-[3px] rounded-lg border border-border bg-neutral-bg p-[3px]',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const loud = item.tone === 'attention' && (item.count ?? 0) > 0;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-9 items-center gap-[7px] rounded-md border px-3.5 text-small',
              'transition-colors duration-[120ms]',
              active
                ? 'border-border bg-surface font-semibold text-text'
                : 'border-transparent bg-transparent font-medium text-text-secondary hover:text-text',
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              loud ? (
                <span className="font-numeric inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-caption tracking-normal text-white">
                  {item.count}
                </span>
              ) : (
                <span className="font-numeric text-text-muted">{item.count}</span>
              )
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
