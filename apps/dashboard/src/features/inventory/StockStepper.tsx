import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface StockStepperProps {
  value: number;
  isLow: boolean;
  disabled?: boolean;
  onCommit: (next: number) => void;
}

/**
 * Stock count with − / + either side of a typed field.
 *
 * Two things keep a managed shop's count right: we decrement automatically
 * after each order, and the shopkeeper corrects everything we cannot see — a
 * supplier delivery, a counter sale, a stock-take. The steppers serve the
 * common case (one or two off), the field serves a stock-take.
 *
 * There is no Save button by design; the value commits on blur.
 */
export function StockStepper({ value, isLow, disabled, onCommit }: StockStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState(false);
  const previous = useRef(value);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  // A brief tint when the number moves on its own — an order came in and took
  // stock off the shelf. Without it the change is completely silent.
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 900);
    return () => window.clearTimeout(timer);
  }, [value]);

  const step = (delta: number) => {
    const next = Math.max(0, value + delta);
    if (next !== value) onCommit(next);
  };

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(Math.floor(parsed));
  };

  const buttonClass = cn(
    'h-[38px] w-8 shrink-0 bg-surface-sunken text-body text-text-secondary',
    'transition-colors duration-[120ms] hover:bg-neutral-bg',
    'disabled:cursor-not-allowed disabled:opacity-50',
  );

  return (
    <div
      className={cn(
        'inline-flex h-10 shrink-0 items-center overflow-hidden rounded-sm border',
        flash ? 'border-warning-border bg-warning-bg' : 'border-border-strong',
      )}
    >
      <button
        type="button"
        aria-label="Decrease stock"
        disabled={disabled || value === 0}
        onClick={() => step(-1)}
        className={buttonClass}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        aria-label="Stock count"
        disabled={disabled}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(value));
            setEditing(false);
            event.currentTarget.blur();
          }
        }}
        className={cn(
          'font-numeric h-[38px] w-[46px] border-x border-border bg-transparent text-center',
          'text-body outline-none disabled:cursor-not-allowed',
          isLow ? 'font-semibold text-warning-fg' : 'text-text',
        )}
      />

      <button
        type="button"
        aria-label="Increase stock"
        disabled={disabled}
        onClick={() => step(1)}
        className={buttonClass}
      >
        +
      </button>
    </div>
  );
}
