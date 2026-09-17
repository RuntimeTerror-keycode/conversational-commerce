import { useEffect, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { ShopSettings } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { useUpdateShopSettings } from './useShopSettings';

/**
 * One window, applied to every day.
 *
 * The backend stores a single `opening_time`/`closing_time` pair on the shop —
 * there is nowhere to put per-day rows, so the UI does not pretend there is.
 *
 * "Open 24 hours" replaces the old "Clear" link. Clearing both times has
 * always meant "always open", but nothing said so; a checkbox that names the
 * outcome is the same write with the meaning attached.
 */
export function OpeningHours({ shop }: { shop: ShopSettings }) {
  const toast = useToast();
  const save = useUpdateShopSettings();

  const [allDay, setAllDay] = useState(shop.openingTime === null);
  const [opening, setOpening] = useState(shop.openingTime ?? '');
  const [closing, setClosing] = useState(shop.closingTime ?? '');

  // Mirror the server until the shopkeeper starts editing.
  useEffect(() => {
    setAllDay(shop.openingTime === null);
    setOpening(shop.openingTime ?? '');
    setClosing(shop.closingTime ?? '');
  }, [shop.openingTime, shop.closingTime]);

  const matching = !allDay && opening !== '' && opening === closing;
  const incomplete = !allDay && (opening === '' || closing === '');

  const dirty = allDay
    ? shop.openingTime !== null
    : opening !== (shop.openingTime ?? '') || closing !== (shop.closingTime ?? '');

  const submit = () => {
    save.mutate(
      allDay
        ? { openingTime: null, closingTime: null }
        : { openingTime: opening, closingTime: closing },
      {
        onSuccess: () => toast('Opening hours saved', 'success'),
        onError: (error) =>
          toast(
            error instanceof ApiRequestError ? error.message : 'Could not save the hours.',
            'error',
          ),
      },
    );
  };

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        title="Opening hours"
        caption="one window, the same every day"
      />

      <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface px-5 py-5">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => setAllDay(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-body font-medium">Open 24 hours</span>
            <span className="text-small text-text-muted">
              Take orders around the clock.
            </span>
          </span>
        </label>

        <div className={cn('grid grid-cols-2 gap-4', allDay && 'opacity-45')}>
          <TimeField
            label="Opens at"
            value={opening}
            invalid={matching}
            disabled={allDay}
            onChange={setOpening}
          />
          <TimeField
            label="Closes at"
            value={closing}
            invalid={matching}
            disabled={allDay}
            onChange={setClosing}
          />
        </div>

        {matching ? (
          <p className="text-small text-danger-fg">
            Opening and closing times cannot match. Tick “Open 24 hours” instead.
          </p>
        ) : (
          <div className="flex items-start gap-2.5 rounded-md bg-surface-sunken px-3.5 py-3">
            <Check className="mt-0.5 size-4 shrink-0 text-success-fg" aria-hidden />
            <p className="font-numeric text-small leading-[1.5] text-text-secondary">
              {preview(allDay, opening, closing)}
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            // Blocked until the window actually means something: both ends set,
            // and not the same instant.
            disabled={!dirty || matching || incomplete}
            loading={save.isPending}
            onClick={submit}
          >
            Save hours
          </Button>
          {incomplete ? (
            <p className="text-small text-text-muted">
              Set both times, or tick “Open 24 hours”.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** The preview must say what will actually happen, in every state. */
function preview(allDay: boolean, opening: string, closing: string): string {
  if (allDay) return 'Always open. Orders arrive at any hour.';
  if (!opening || !closing) return 'Set both times to see what customers get.';
  if (closing < opening) {
    return `Open overnight, ${opening} until ${closing} the next morning.`;
  }
  return `Open every day, ${opening} – ${closing}.`;
}

function TimeField({
  label,
  value,
  invalid,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  invalid: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      <span className="relative">
        <Clock
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-disabled"
          aria-hidden
        />
        <input
          type="time"
          value={value}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            'font-numeric h-[46px] w-full rounded-sm bg-surface pr-3 pl-9 text-[15px]',
            'transition-[border-color,box-shadow] duration-[120ms]',
            'focus:border-accent focus:ring-[3px] focus:ring-accent-subtle focus:outline-none',
            'disabled:cursor-not-allowed',
            invalid ? 'border-[1.5px] border-danger-fg' : 'border border-border-strong',
          )}
        />
      </span>
    </label>
  );
}

export function SectionHeading({ title, caption }: { title: string; caption: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-small text-text-muted">{caption}</p>
    </div>
  );
}
