import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Off means "out of stock", which is a problem, not a neutral state. */
  offTone?: 'neutral' | 'danger';
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  offTone = 'neutral',
}: ToggleProps) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-success' : offTone === 'danger' ? 'bg-danger-border' : 'bg-border-strong',
      )}
    >
      <Switch.Thumb
        className={cn(
          'block size-4 translate-x-0.5 rounded-full bg-white shadow-xs',
          'transition-transform duration-200 ease-out',
          'data-[state=checked]:translate-x-4.5',
        )}
      />
    </Switch.Root>
  );
}
