import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import { PageHeader } from '@/app/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/features/auth/useSession';
import { cn } from '@/lib/cn';
import { OpeningHours, SectionHeading } from './OpeningHours';
import { ShopDetails } from './ShopDetails';
import { shopStatusMeta, statusDetail } from './shopStatus';
import { useShopSettings, useUpdateShopSettings } from './useShopSettings';

/**
 * One column, ordered by how often a shopkeeper needs each thing.
 *
 * The previous version had the shop's state in four places — a header pill, a
 * "Current status" row, a "Right now" card and the sidebar chip — which meant
 * four chances to disagree. Two are left: the sidebar, and Availability here.
 */
export function SettingsPage() {
  const session = useSession();
  const { data: shop, isPending } = useShopSettings();

  if (isPending || !shop || !session.data) {
    return (
      <>
        <PageHeader eyebrow="Your shop" title="Settings" />
        <div className="max-w-[820px] px-4 pb-[30px] md:px-10">
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Your shop" title="Settings" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex max-w-[820px] flex-col gap-[30px] px-4 pb-[30px] md:px-10">
        <Availability shop={shop} />
        <OpeningHours shop={shop} />
        <ShopDetails shop={shop} />
        </div>
      </div>
    </>
  );
}

function Availability({ shop }: { shop: import('@/api/types').ShopSettings }) {
  const toast = useToast();
  const save = useUpdateShopSettings();
  const [explaining, setExplaining] = useState(false);
  const status = shopStatusMeta[shop.openState];

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        title="Availability"
        caption="whether the assistant is taking new orders right now"
      />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center gap-4 px-5 py-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  'size-2.5 shrink-0 rounded-full',
                  shop.openState === 'offline'
                    ? 'bg-neutral-fg'
                    : shop.openState === 'closed'
                      ? 'bg-text-disabled'
                      : 'bg-success',
                )}
                aria-hidden
              />
              <p className="text-[22px] font-semibold">{status.label}</p>
            </div>
            <p className="font-numeric mt-1 text-small text-text-secondary">
              {shop.openState === 'open' || shop.openState === 'always_open'
                ? `Taking orders on WhatsApp · ${statusDetail(shop).toLowerCase()}`
                : statusDetail(shop)}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <Toggle
              size="lg"
              checked={shop.isActive}
              label="Taking orders"
              disabled={save.isPending}
              onChange={(isActive) =>
                save.mutate(
                  { isActive },
                  {
                    onSuccess: () =>
                      toast(isActive ? 'Taking orders' : 'Shop switched off', 'success'),
                    onError: (error) =>
                      toast(
                        error instanceof ApiRequestError
                          ? error.message
                          : 'Could not change that.',
                        'error',
                      ),
                  },
                )
              }
            />
            <span className="text-xs text-text-muted">Taking orders</span>
          </div>
        </div>

        {/* Documentation, folded away. It is worth having — the difference
            between "closed" and "switched off" is what a shopkeeper needs at
            9am when orders are not arriving — but it is not a setting. */}
        <button
          type="button"
          aria-expanded={explaining}
          onClick={() => setExplaining((open) => !open)}
          className="flex w-full items-center gap-2.5 border-t border-border bg-surface-sunken px-5 py-3 text-left transition-colors hover:bg-neutral-bg"
        >
          <Info className="size-4 shrink-0 text-text-muted" aria-hidden />
          <span className="text-small text-text-secondary">
            What “Open”, “Closed now” and “Switched off” mean
          </span>
          <ChevronDown
            className={cn(
              'ml-auto size-4 shrink-0 text-text-muted transition-transform duration-[120ms]',
              explaining && 'rotate-180',
            )}
            aria-hidden
          />
        </button>

        {explaining ? (
          <dl className="flex flex-col gap-3 border-t border-border px-5 py-4">
            {[
              {
                term: 'Open',
                detail: 'Inside your hours and switched on. Orders are arriving.',
                strong: null,
              },
              {
                term: 'Closed now',
                detail: 'Outside your hours. ',
                strong: shop.openingTime
                  ? `Reopens by itself at ${shop.openingTime} — nothing to do.`
                  : 'Reopens by itself — nothing to do.',
              },
              {
                term: 'Switched off',
                detail: 'You turned it off. ',
                strong: 'Stays off until you turn it back on, even inside your hours.',
              },
            ].map((state) => (
              <div key={state.term} className="flex gap-3 text-small">
                <dt className="w-[110px] shrink-0 font-semibold">{state.term}</dt>
                <dd className="text-text-secondary">
                  {state.detail}
                  {state.strong ? (
                    <span className="font-medium text-text">{state.strong}</span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
