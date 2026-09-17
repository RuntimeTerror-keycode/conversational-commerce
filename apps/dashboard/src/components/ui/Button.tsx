import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'attention' | 'destructive';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Geometry taken from the design canvas, "Components" artboard:
 *   md  44px tall, 20px padding, 14px  — the row action, sized for a thumb
 *   sm  36px tall, 14px padding, 13px  — toolbars and secondary rows
 * Radius 6 on every button; 1px border on every variant so they share a
 * silhouette whether or not they are filled.
 */
const variants: Record<Variant, string> = {
  primary: cn(
    'border-accent bg-accent text-on-accent font-semibold',
    'hover:border-accent-hover hover:bg-accent-hover',
    'disabled:border-text-disabled disabled:bg-text-disabled',
  ),
  secondary: cn(
    'border-border-strong bg-surface text-text font-medium',
    'hover:bg-surface-sunken',
  ),
  ghost: 'border-transparent bg-transparent text-accent font-medium hover:bg-accent-subtle',
  attention: cn(
    'border-warning bg-warning text-on-accent font-semibold',
    'hover:brightness-110',
  ),
  danger: cn(
    'border-danger-border bg-surface text-danger-fg font-medium',
    'hover:bg-danger-bg',
  ),
  destructive: cn(
    'border-danger-fg bg-danger-fg text-on-accent font-semibold',
    'hover:brightness-110',
  ),
};

const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-3.5 text-small',
  md: 'h-11 gap-2 px-5 text-body',
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
        'relative inline-flex shrink-0 items-center justify-center rounded-md border',
        'whitespace-nowrap transition-colors duration-[120ms]',
        'disabled:cursor-not-allowed disabled:opacity-70',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {/* The label holds its width while loading, so the button never resizes
          mid-click and shifts the row under the cursor. */}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>
      {loading ? (
        <Loader2 className="absolute size-4 animate-spin" aria-hidden />
      ) : null}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** `bare` is the drawer close; the default carries a border. */
  variant?: 'bordered' | 'bare';
  children: ReactNode;
}

export function IconButton({
  label,
  variant = 'bordered',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-md border',
        'text-text-secondary transition-colors duration-[120ms]',
        variant === 'bordered'
          ? 'border-border-strong bg-surface hover:bg-surface-sunken'
          : 'border-transparent bg-transparent hover:bg-surface-sunken',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
