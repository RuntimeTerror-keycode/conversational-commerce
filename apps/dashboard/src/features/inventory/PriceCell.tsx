import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

interface PriceCellProps {
  value: number;
  disabled?: boolean;
  onCommit: (next: number) => void;
}

/** Price, edited in place. Commits on blur — no Save button by design. */
export function PriceCell({ value, disabled, onCommit }: PriceCellProps) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <div
      className={cn(
        'flex h-10 items-center rounded-sm border border-border-strong bg-surface pl-2.5',
        disabled && 'bg-surface-sunken',
      )}
    >
      <span className="text-small text-text-muted">₹</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label="Selling price"
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
          'font-numeric h-[38px] w-full border-none bg-transparent px-2 text-body',
          'outline-none disabled:cursor-not-allowed',
        )}
      />
    </div>
  );
}
