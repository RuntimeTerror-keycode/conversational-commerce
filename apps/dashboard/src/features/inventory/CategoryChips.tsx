import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface CategoryChipsProps {
  categories: string[];
  value: string;
  total?: number;
  onChange: (category: string) => void;
}

/**
 * How many chips stay on the row before the rest fold away.
 *
 * Kerala grocery categories are long — "Instant Food & Noodles", "Cleaning &
 * Household" — and a shop carrying the full catalogue has thirteen of them,
 * which wraps to three rows and pushes the table off the screen. Six is about
 * one row at the narrowest desktop width we support.
 */
const VISIBLE = 6;

/**
 * Chips, not a dropdown.
 *
 * A shop switches between a handful of categories constantly; a select hides
 * every option behind a click and gives no sense of how many there are. The
 * long tail folds behind "+N more" so the common ones stay one click away
 * without the control eating the page.
 *
 * The list comes from the API, so it covers the whole shop rather than
 * whatever happens to be on the current page.
 */
export function CategoryChips({ categories, value, total, onChange }: CategoryChipsProps) {
  const [expanded, setExpanded] = useState(false);

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3.5',
      'text-small font-medium transition-colors duration-[120ms]',
      active
        ? 'border-text bg-text text-canvas'
        : 'border-border bg-surface text-text-secondary hover:border-border-strong',
    );

  // A selected category always stays on the row, even if it sits in the tail —
  // a filter you cannot see is a filter you forget is on.
  const head = categories.slice(0, VISIBLE);
  const selectedInTail = value !== '' && !head.includes(value);
  const shown = expanded
    ? categories
    : selectedInTail
      ? [...categories.slice(0, VISIBLE - 1), value]
      : head;
  const hidden = categories.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange('')} className={chip(value === '')}>
        All
        {total !== undefined ? (
          <span className="font-numeric opacity-70">{total}</span>
        ) : null}
      </button>

      {shown.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={chip(value === category)}
        >
          {category}
        </button>
      ))}

      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className={cn(chip(false), 'text-text-muted')}
        >
          {expanded ? 'Show fewer' : `+${hidden} more`}
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform duration-[120ms]',
              expanded && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}
