import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

export interface SegmentItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** Tints the count pill — used so "New" stays amber wherever it appears. */
  tone?: 'attention' | 'neutral';
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
 * section break; this reads as one control, which is what it is. Built on
 * Radix Tabs for correct roving-tabindex keyboard behaviour, even though
 * there's no associated Tabs.Content — this is a filter bar, not a panel
 * switcher.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(next as T)}>
      <Tabs.List
        className={cn(
          'inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5',
          className,
        )}
      >
        {items.map((item) => {
          const active = item.value === value;
          const showAttentionTone = item.tone === 'attention' && (item.count ?? 0) > 0;

          return (
            <Tabs.Trigger
              key={item.value}
              value={item.value}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5',
                'text-small font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
                active
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-secondary hover:text-text',
              )}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 ? (
                <span
                  className={cn(
                    'font-numeric rounded px-1 py-px text-caption font-semibold tracking-normal',
                    showAttentionTone
                      ? 'bg-warning text-white'
                      : active
                        ? 'bg-surface-sunken text-text-secondary'
                        : 'bg-border text-text-muted',
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </Tabs.Trigger>
          );
        })}
      </Tabs.List>
    </Tabs.Root>
  );
}
