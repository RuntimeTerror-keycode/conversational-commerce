import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Primary is ink, not a brand colour — see the palette note in index.css.
 * The active state uses a 1px translate rather than a scale, which reads as a
 * physical press instead of a zoom.
 */
const variants: Record<Variant, string> = {
  primary: cn(
    'bg-ink text-white shadow-xs',
    'hover:bg-ink/90 active:translate-y-px',
    'disabled:bg-ink-4 disabled:shadow-none',
  ),
  secondary: cn(
    'bg-surface text-ink border border-line shadow-xs',
    'hover:border-line-strong hover:bg-sunk active:translate-y-px',
  ),
  ghost: 'text-ink-2 hover:bg-sunk hover:text-ink active:translate-y-px',
  danger: cn(
    'bg-surface text-bad border border-bad-line',
    'hover:bg-bad-soft active:translate-y-px',
  ),
};

const sizes: Record<Size, string> = {
  xs: 'h-6 gap-1 rounded-sm px-2 text-xs',
  sm: 'h-7.5 gap-1.5 rounded-md px-2.5 text-xs',
  md: 'h-9 gap-1.5 rounded-md px-3.5 text-base',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,border-color,transform,opacity] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {/* The label keeps its width while loading, so the button never resizes
          mid-click and shift the row under the cursor. */}
      <span className={cn('inline-flex items-center gap-1.5', loading && 'invisible')}>
        {children}
      </span>
      {loading ? (
        <Loader2 className="absolute size-3.5 animate-spin" aria-hidden />
      ) : null}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md',
        'text-ink-3 transition-colors duration-150 hover:bg-sunk hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
