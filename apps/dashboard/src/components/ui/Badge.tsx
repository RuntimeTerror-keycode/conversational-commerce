import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'neutral';

interface BadgeProps {
  tone?: Tone;
  /** Solid reads as terminal — used for Delivered, so finished work settles. */
  solid?: boolean;
  /** Every badge should carry one — DESIGN_SYSTEM §2: colour never carries status alone. */
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}

const tones: Record<Tone, { soft: string; solid: string }> = {
  success: { soft: 'bg-success-bg text-success-fg border-success-border', solid: 'bg-success text-white border-transparent' },
  warning: { soft: 'bg-warning-bg text-warning-fg border-warning-border', solid: 'bg-warning text-white border-transparent' },
  danger:  { soft: 'bg-danger-bg text-danger-fg border-danger-border',    solid: 'bg-danger text-white border-transparent' },
  info:    { soft: 'bg-info-bg text-info-fg border-info-border',         solid: 'bg-info text-white border-transparent' },
  violet:  { soft: 'bg-violet-bg text-violet-fg border-violet-border',   solid: 'bg-violet text-white border-transparent' },
  neutral: { soft: 'bg-neutral-bg text-neutral-fg border-neutral-border', solid: 'bg-text text-white border-transparent' },
};

export function Badge({ tone = 'neutral', solid, icon: Icon, className, children }: BadgeProps) {
  const style = tones[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5',
        'text-caption font-medium whitespace-nowrap',
        solid ? style.solid : style.soft,
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}
