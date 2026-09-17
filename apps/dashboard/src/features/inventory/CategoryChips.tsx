import { cn } from '@/lib/cn';

interface CategoryChipsProps {
  categories: string[];
  value: string;
  total?: number;
  onChange: (category: string) => void;
}

/**
 * Chips, not a dropdown.
 *
 * A shop stocks a handful of categories and switches between them constantly;
 * a select hides every option behind a click and gives no sense of how many
 * there are. The list comes from the API, so it covers the whole shop rather
 * than whatever happens to be on the current page.
 */
export function CategoryChips({ categories, value, total, onChange }: CategoryChipsProps) {
  const chip = (active: boolean) =>
    cn(
      'inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3.5',
      'text-small font-medium transition-colors duration-[120ms]',
      active
        ? 'border-text bg-text text-canvas'
        : 'border-border bg-surface text-text-secondary hover:border-border-strong',
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onChange('')} className={chip(value === '')}>
        All
        {total !== undefined ? (
          <span className="font-numeric opacity-70">{total}</span>
        ) : null}
      </button>

      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={chip(value === category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
