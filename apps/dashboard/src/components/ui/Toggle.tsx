import * as Switch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** `lg` is the 62x34 switch the design uses wherever it is the only control. */
  size?: 'sm' | 'lg';
}

const track = {
  sm: 'h-5 w-9',
  lg: 'h-[34px] w-[62px]',
};

const thumb = {
  sm: 'size-4 translate-x-0.5 data-[state=checked]:translate-x-4.5',
  lg: 'size-[26px] translate-x-[3px] data-[state=checked]:translate-x-[33px]',
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  size = 'sm',
}: ToggleProps) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'relative shrink-0 rounded-full transition-colors duration-200',
        track[size],
        'focus-visible:outline-none focus-visible:ring focus-visible:ring-border-focus focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-border-strong',
      )}
    >
      <Switch.Thumb
        className={cn(
          'block rounded-full bg-white shadow-xs',
          'transition-transform duration-200 ease-out',
          thumb[size],
        )}
      />
    </Switch.Root>
  );
}
