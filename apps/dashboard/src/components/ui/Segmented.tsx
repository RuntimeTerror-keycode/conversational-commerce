import { cn } from '@/lib/cn';

export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Tints the count pill — used so "New" stays amber wherever it appears. */
  tone?: 'new' | 'neutral';
}

interface SegmentedProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * A sliding pill on an inset track, not underlined tabs.
 *
 * Underlines put a hard rule across the page and make the filter read as a
 * section break; this reads as one control, which is what it is.
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
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunk p-0.5',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const showNewTone = item.tone === 'new' && (item.count ?? 0) > 0;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5',
              'text-sm font-medium transition-all duration-150',
              active
                ? 'bg-surface text-ink shadow-xs'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 ? (
              <span
                className={cn(
                  'tnum rounded px-1 py-px text-2xs font-semibold tracking-normal',
                  showNewTone
                    ? 'bg-new text-white'
                    : active
                      ? 'bg-sunk text-ink-2'
                      : 'bg-line-soft text-ink-3',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
