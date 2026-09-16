import { cn } from '@/lib/cn';

interface LiveDotProps {
  state: 'live' | 'stale';
  className?: string;
}

/**
 * Says out loud whether the 3s poll is still landing.
 *
 * Without it, a dropped connection looks identical to a quiet shop — the list
 * just sits there showing orders that may be minutes stale. On conference
 * wifi that distinction is the difference between calm and panic.
 */
export function LiveDot({ state, className }: LiveDotProps) {
  const live = state === 'live';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="relative flex size-1.5">
        {live ? (
          <span
            className="absolute inset-0 rounded-full bg-done animate-beacon"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            'relative size-1.5 rounded-full',
            live ? 'bg-done' : 'bg-new',
          )}
        />
      </span>
      <span className={cn('text-xs', live ? 'text-ink-3' : 'text-new-ink')}>
        {live ? 'Live' : 'Reconnecting'}
      </span>
    </span>
  );
}
