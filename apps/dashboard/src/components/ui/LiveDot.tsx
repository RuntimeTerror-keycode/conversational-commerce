import { cn } from '@/lib/cn';

interface LiveDotProps {
  state: 'live' | 'stale';
  className?: string;
}

/**
 * Says out loud whether the 3s poll is still landing.
 *
 * Without it a dropped connection looks identical to a quiet shop — the list
 * just sits there showing orders that may be minutes stale.
 *
 * The stale state is deliberately colourless: a dashed border and muted text.
 * This is the connection's state, never the shop's, and amber here would
 * compete with the one thing amber is for — an order that needs packing.
 */
export function LiveDot({ state, className }: LiveDotProps) {
  const live = state === 'live';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        live
          ? 'border-transparent text-text-muted'
          : 'border-dashed border-border-strong text-text-muted',
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          live ? 'bg-success' : 'bg-text-disabled',
        )}
        aria-hidden
      />
      <span className="text-caption tracking-normal">
        {live ? 'Live' : 'Not updating'}
      </span>
    </span>
  );
}
