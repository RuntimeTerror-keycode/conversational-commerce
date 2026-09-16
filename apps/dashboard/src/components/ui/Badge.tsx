import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'new' | 'packed' | 'transit' | 'done' | 'bad' | 'neutral';

interface BadgeProps {
  tone?: Tone;
  /** Solid reads as terminal — used for Delivered, so finished work settles. */
  solid?: boolean;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const tones: Record<Tone, { soft: string; solid: string; dot: string }> = {
  new: {
    soft: 'bg-new-soft text-new-ink border-new-line',
    solid: 'bg-new text-white border-transparent',
    dot: 'bg-new',
  },
  packed: {
    soft: 'bg-packed-soft text-packed border-packed-line',
    solid: 'bg-packed text-white border-transparent',
    dot: 'bg-packed',
  },
  transit: {
    soft: 'bg-transit-soft text-transit border-transit-line',
    solid: 'bg-transit text-white border-transparent',
    dot: 'bg-transit',
  },
  done: {
    soft: 'bg-done-soft text-done border-done-line',
    solid: 'bg-done text-white border-transparent',
    dot: 'bg-done',
  },
  bad: {
    soft: 'bg-bad-soft text-bad border-bad-line',
    solid: 'bg-bad text-white border-transparent',
    dot: 'bg-bad',
  },
  neutral: {
    soft: 'bg-sunk text-ink-2 border-line',
    solid: 'bg-ink text-white border-transparent',
    dot: 'bg-ink-3',
  },
};

export function Badge({ tone = 'neutral', solid, dot, className, children }: BadgeProps) {
  const style = tones[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'text-xs font-medium whitespace-nowrap',
        solid ? style.solid : style.soft,
        className,
      )}
    >
      {dot ? (
        <span
          className={cn('size-1.5 shrink-0 rounded-full', solid ? 'bg-white' : style.dot)}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}
