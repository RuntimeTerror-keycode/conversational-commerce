import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * Forwards its ref to the native input — required for react-hook-form's
 * `register()`, which attaches via ref rather than a controlled `value` prop.
 * Without this, RHF's defaultValues never reach the DOM node.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      ) : null}

      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-text-disabled">
            {leading}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full rounded-sm border bg-surface px-3 text-body text-text',
            'transition-[border-color,box-shadow] duration-[120ms]',
            'placeholder:text-text-disabled',
            'focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-subtle',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted',
            error ? 'border-[1.5px] border-danger-fg' : 'border-border-strong',
            leading && 'pl-9',
            trailing && 'pr-9',
            className,
          )}
          {...rest}
        />

        {trailing ? (
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-caption text-danger-fg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-caption text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
