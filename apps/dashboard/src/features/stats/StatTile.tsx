import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/Skeleton';

interface StatTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** `alert` is reserved for the one figure that means "act now". */
  tone?: 'default' | 'alert';
  onClick?: () => void;
  loading?: boolean;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  loading,
}: StatTileProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-3.5 shadow-xs">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2.5 h-9 w-16" />
      </div>
    );
  }

  const Element = onClick ? 'button' : 'div';
  const alert = tone === 'alert';

  return (
    <Element
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'rounded-xl border bg-surface px-4 py-3.5 text-left shadow-xs',
        'transition-all duration-150',
        alert ? 'border-warning-border bg-warning-bg/40' : 'border-border',
        onClick && 'hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
      )}
    >
      <p className="text-caption text-text-muted uppercase tracking-wide">{label}</p>
      <p className={cn('font-numeric text-metric', alert ? 'text-warning-fg' : 'text-text')}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-caption text-text-muted">{hint}</p> : null}
    </Element>
  );
}
