import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  leading,
  trailing,
  className,
  id,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="label">
          {label}
        </label>
      ) : null}

      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4">
            {leading}
          </span>
        ) : null}

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-9 w-full rounded-md border bg-surface px-2.5 text-base text-ink shadow-xs',
            'transition-[border-color,box-shadow] duration-150',
            'placeholder:text-ink-4',
            'disabled:cursor-not-allowed disabled:bg-sunk disabled:text-ink-3',
            error
              ? 'border-bad-line'
              : 'border-line hover:border-line-strong',
            leading && 'pl-8',
            trailing && 'pr-8',
            className,
          )}
          {...rest}
        />

        {trailing ? (
          <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
