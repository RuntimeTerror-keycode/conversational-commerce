import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/**
 * The single container in the system.
 *
 * There is deliberately no Card-inside-Card: nesting surfaces is the fastest
 * route to admin-template soup. Inside a Panel, hierarchy comes from hairline
 * dividers, spacing and type weight.
 */
export function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-surface shadow-xs',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({ title, action, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border px-4 py-3',
        className,
      )}
    >
      <h2 className="text-h3">{title}</h2>
      {action}
    </div>
  );
}
