import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface PageHeaderProps {
  /** Small caps line above the title — names the job, not the screen. */
  eyebrow?: string;
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
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 bg-canvas/85 backdrop-blur-md',
        className,
      )}
    >
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-4 pt-[30px] pb-4 md:px-9">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-caption tracking-[0.1em] text-text-muted uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-h1">{title}</h1>
          {subtitle ? (
            <div className="mt-0.5 text-small text-text-muted">{subtitle}</div>
          ) : null}
        </div>

        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
