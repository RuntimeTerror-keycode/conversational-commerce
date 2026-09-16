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
    <span className={cn('inline-flex items-center gap-1.5', className)} role="status">
      <span className="relative flex size-1.5">
        {live ? (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-success"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            'relative size-1.5 rounded-full',
            live ? 'bg-success' : 'bg-warning',
          )}
        />
      </span>
      <span className={cn('text-caption', live ? 'text-text-muted' : 'text-warning-fg')}>
        {live ? 'Live' : 'Reconnecting'}
      </span>
    </span>
  );
}
