import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  /** `alert` is reserved for the one figure that means "act now". */
  tone?: 'default' | 'alert';
  onClick?: () => void;
  loading?: boolean;
}

/**
 * Icon and caps label on one line, then the figure at 34px.
 *
 * Only the attention tile takes a fill — a row of five tinted boxes would make
 * the one that matters invisible.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
  loading,
}: StatTileProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-14" />
        <Skeleton className="mt-2 h-3 w-20" />
      </div>
    );
  }

  const Element = onClick ? 'button' : 'div';
  const alert = tone === 'alert';

  return (
    <Element
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border px-4 py-3.5 text-left',
        'transition-colors duration-[120ms]',
        alert
          ? 'border-warning-border bg-warning-bg'
          : 'border-border bg-surface hover:bg-surface-hover',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-1.5 text-caption tracking-[0.08em] uppercase',
          alert ? 'text-warning-fg' : 'text-text-muted',
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </span>

      <span
        className={cn(
          'font-numeric text-metric',
          alert ? 'text-warning-fg' : 'text-text',
        )}
      >
        {value}
      </span>

      {hint ? (
        <span
          className={cn(
            'text-xs',
            alert ? 'text-warning-fg/80' : 'text-text-muted',
          )}
        >
          {hint}
        </span>
      ) : null}
    </Element>
  );
}
