import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** `calm` for "nothing to do, that's fine" — the common case here. */
  tone?: 'calm' | 'neutral';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'animate-fade-in flex flex-col items-center justify-center gap-3 px-6 py-16 text-center',
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full',
            tone === 'calm' ? 'bg-success-bg text-success-fg' : 'bg-surface-sunken text-text-muted',
          )}
        >
          {icon}
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="font-semibold text-text">{title}</p>
        {description ? (
          <p className="mx-auto max-w-xs text-small text-text-muted">{description}</p>
        ) : null}
      </div>

      {action}
    </div>
  );
}
