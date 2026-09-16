import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Sticky, hairline-bottomed, and deliberately quiet.
 *
 * It stays put while a long order list scrolls so the page title and the live
 * indicator never leave the screen — on a counter display the shopkeeper is
 * often several screens down the list.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 md:px-7">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle ? (
            <div className="mt-0.5 text-sm text-ink-3">{subtitle}</div>
          ) : null}
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
