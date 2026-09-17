import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface StockCellProps {
  value: number;
  isLow: boolean;
  editable: boolean;
  onCommit: (next: number) => void;
}

/**
 * Stock count, editable in place for managed shops.
 *
 * Two things keep a managed shop's count right: we decrement automatically
 * after each order, and the shopkeeper corrects it for everything we cannot
 * see — a supplier delivery, a counter sale, a stock-take. This is the second
 * one, and it is an ordinary field rather than a separate stock mechanism.
 *
 * It reads as plain text until hovered, so a column of forty rows does not
 * look like a column of forty form inputs.
 */
export function StockCell({ value, isLow, editable, onCommit }: StockCellProps) {
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

  if (!editable) {
    return <span className="font-numeric text-small text-text-muted">{value}</span>;
  }

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(Math.floor(parsed));
  };

  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      aria-label="Stock count"
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
        'font-numeric h-8 w-16 rounded-md border border-transparent bg-transparent px-2 text-right text-small',
        'transition-colors duration-200',
        'hover:border-border-strong hover:bg-surface',
        'focus-visible:border-accent focus-visible:bg-surface focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
        flash && 'border-warning-border bg-warning-bg',
        isLow ? 'font-semibold text-warning-fg' : 'text-text',
      )}
    />
  );
}
