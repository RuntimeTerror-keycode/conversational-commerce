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
      <div className="rounded-xl border border-line bg-surface px-4 py-3.5 shadow-xs">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-2.5 h-7 w-14" />
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
        alert ? 'border-new-line bg-new-soft/40' : 'border-line',
        onClick && 'hover:-translate-y-px hover:shadow-sm',
      )}
    >
      <p className="label">{label}</p>
      <p
        className={cn(
          'tnum mt-1 text-2xl font-semibold',
          alert ? 'text-new-ink' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-3">{hint}</p> : null}
    </Element>
  );
}
