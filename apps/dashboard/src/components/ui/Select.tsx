import { useId } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Radix's Select.Item forbids an empty-string value (it reserves "" to mean
 * "nothing selected" internally), but our option lists legitimately use ""
 * for "All categories" etc. — mapped to this sentinel at the boundary so
 * callers never need to know about the quirk.
 */
const EMPTY = '__all__';

export function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: SelectProps) {
  const generatedId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={generatedId} className="label">
          {label}
        </label>
      ) : null}

      <RadixSelect.Root
        value={value === '' ? EMPTY : value}
        onValueChange={(next) => onValueChange(next === EMPTY ? '' : next)}
      >
        <RadixSelect.Trigger
          id={generatedId}
          aria-label={ariaLabel ?? label}
          className={cn(
            'inline-flex h-10 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-2.5',
            'text-body text-text shadow-xs transition-colors duration-150',
            'hover:border-text-disabled data-[placeholder]:text-text-disabled',
            'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled',
            className,
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <ChevronDown className="size-4 text-text-disabled" aria-hidden />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-72 overflow-hidden rounded-lg border border-border bg-surface shadow-md"
          >
            <RadixSelect.Viewport className="p-1">
              {options.map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value === '' ? EMPTY : option.value}
                  className={cn(
                    'relative flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-6 pl-2',
                    'text-small text-text outline-none select-none',
                    'data-[highlighted]:bg-surface-hover',
                  )}
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="absolute right-2 inline-flex items-center">
                    <Check className="size-3.5 text-accent" aria-hidden />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}
