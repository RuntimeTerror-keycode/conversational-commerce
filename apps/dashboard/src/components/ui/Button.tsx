import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

/** DESIGN_SYSTEM.md §6 — four variants, three sizes, all seven states. */
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-xs hover:bg-accent-hover active:bg-accent-active disabled:bg-text-disabled disabled:shadow-none',
  secondary: 'bg-surface text-text border border-border-strong shadow-xs hover:bg-surface-hover disabled:text-text-disabled disabled:bg-surface-sunken',
  ghost: 'text-text-secondary hover:bg-surface-hover disabled:text-text-disabled',
  danger: 'bg-danger text-white hover:bg-danger-hover disabled:bg-text-disabled',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-small',
  md: 'h-10 gap-1.5 rounded-lg px-3.5 text-small',
  lg: 'h-11 gap-2 rounded-lg px-4 text-body',
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
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {/* The label keeps its width while loading, so the button never resizes
          mid-click and shifts the row under the cursor. */}
      <span className={cn('inline-flex items-center gap-1.5', loading && 'invisible')}>
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
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-md',
        'text-text-secondary transition-colors duration-150 hover:bg-surface-hover hover:text-text',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
