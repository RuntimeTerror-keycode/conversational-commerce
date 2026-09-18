import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Ban } from 'lucide-react';
import type { LowStockProduct } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import { useShopSettings, useUpdateShopSettings } from '@/features/settings/useShopSettings';
import { shopStatusMeta, statusDetail } from '@/features/settings/shopStatus';
import { useFulfillments } from '@/features/orders/useOrders';
import { formatDuration, formatMoney, plural, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { BusiestHours } from './BusiestHours';
import { useDashboardStats } from './useDashboard';

/**
 * Today — the shop, not the queue.
 *
 * The rule the design applies: if it can be seen on the Orders screen, it is
 * not on this one. So no order rows and no per-order buttons — a count and a
 * door instead, then the things the queue can never show: when the shop is
 * busy, what it took today, how fast it moved, what is running out.
 */
const panel = 'rounded-lg border border-border bg-surface';

export function DashboardPage() {
  const navigate = useNavigate();
  const stats = useDashboardStats();
  const { data: shop } = useShopSettings();
  const save = useUpdateShopSettings();

  // The two figures the attention strip needs live on the queue, not in the
  // stats roll-up — the strip is about what is waiting right now.
  const waiting = useFulfillments({ status: 'accepted' });
  const counts = waiting.data?.counts;
  const oldest = waiting.data?.data.at(-1)?.acceptedAt ?? null;

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      <PageHeader eyebrow={today} title="Today" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-content flex-col gap-[18px] px-4 pb-[30px] md:px-9">
        <AttentionStrip
          waiting={counts?.accepted ?? 0}
          packed={counts?.packed ?? 0}
          oldest={oldest}
          loading={waiting.isPending && !waiting.data}
          onOpen={() => navigate('/orders')}
        />

        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_348px]">
          <section className={cn(panel, 'px-[22px] pt-[18px] pb-4')}>
            {stats.isPending && !stats.data ? (
              <Skeleton className="h-[232px]" />
            ) : stats.error ? (
              <ErrorState
                title="Could not load the day"
                onRetry={() => void stats.refetch()}
              />
            ) : stats.data ? (
              <BusiestHours data={stats.data.busiestHours} />
            ) : null}
          </section>

          <div className="flex flex-col gap-[18px]">
            <Takings stats={stats.data} loading={stats.isPending && !stats.data} />

            {shop ? (
              <section className={cn(panel, 'flex flex-col gap-3.5 px-5 py-[18px]')}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
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
                      <span className="text-lg font-semibold">
                        {shopStatusMeta[shop.openState].label}
                      </span>
                    </div>
                    <p className="font-numeric text-[12.5px] text-text-secondary">
                      {statusDetail(shop)}
                    </p>
                  </div>

                  <div className="ml-auto shrink-0">
                    <Toggle
                      checked={shop.isActive}
                      label="Taking orders"
                      disabled={save.isPending}
                      onChange={(isActive) => save.mutate({ isActive })}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={() => navigate('/settings')}>
                  Opening hours &amp; shop details
                </Button>
              </section>
            ) : (
              <Skeleton className="h-[134px] rounded-lg" />
            )}
          </div>
        </div>

        <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1fr)_348px]">
          <RunningOut
            products={stats.data?.runningOut}
            loading={stats.isPending && !stats.data}
          />
          <Speed stats={stats.data} loading={stats.isPending && !stats.data} />
        </div>
        </div>
      </div>
    </>
  );
}

/**
 * A count and a door, not a list.
 *
 * The oldest wait is the part that actually changes behaviour — "2 waiting"
 * is survivable, "the oldest has been waiting 40 minutes" is not.
 */
function AttentionStrip({
  waiting,
  packed,
  oldest,
  loading,
  onOpen,
}: {
  waiting: number;
  packed: number;
  oldest: string | null;
  loading: boolean;
  onOpen: () => void;
}) {
  if (loading) return <Skeleton className="h-[90px] rounded-lg" />;

  if (waiting === 0) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface px-6 py-5">
        <p className="text-body font-semibold">Nothing waiting to be packed.</p>
        <p className="text-small text-text-secondary">
          {packed > 0
            ? `${plural(packed, 'order')} packed and ready to hand over.`
            : 'Every order that has come in is on its way.'}
        </p>
        <Button variant="secondary" className="ml-auto" onClick={onOpen}>
          Open the queue
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[22px] rounded-lg border border-warning-border bg-warning-bg px-6 py-5">
      <span className="font-numeric text-[44px] leading-none font-semibold text-warning-fg">
        {waiting}
      </span>

      <div className="flex flex-col gap-[3px]">
        <p className="text-[17px] font-semibold text-warning-fg">
          {waiting === 1 ? 'order waiting to be packed' : 'orders waiting to be packed'}
        </p>
        <p className="font-numeric text-small text-warning-fg">
          {oldest ? `The oldest has been waiting ${timeAgo(oldest).replace(' ago', '')}.` : ''}
          {packed > 0
            ? ` ${packed === 1 ? 'One more is' : `${packed} more are`} packed and ready to hand over.`
            : ''}
        </p>
      </div>

      <Button variant="attention" className="ml-auto h-[46px] shrink-0" onClick={onOpen}>
        Open the queue
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

function Takings({
  stats,
  loading,
}: {
  stats: { takingsToday: import('@/api/types').TakingsToday } | undefined;
  loading: boolean;
}) {
  if (loading || !stats) return <Skeleton className="h-[148px] rounded-lg" />;

  const { revenue, orders, items, changeOnLastWeek } = stats.takingsToday;
  const average = orders > 0 ? Math.round(revenue / orders) : 0;

  return (
    <section className={cn(panel, 'flex flex-col gap-3 px-5 py-[18px]')}>
      <h2 className="text-caption tracking-[0.08em] text-text-muted uppercase">
        Takings today
      </h2>

      <div className="flex items-baseline gap-2.5">
        <p className="font-numeric text-[38px] leading-none font-semibold tracking-[-0.02em]">
          {formatMoney(revenue)}
        </p>
        {/* Same weekday last week — a Thursday against a Thursday is the only
            comparison that means anything to a shop. */}
        {changeOnLastWeek !== 0 ? (
          <p
            className={cn(
              'font-numeric text-[12.5px] font-medium',
              changeOnLastWeek > 0 ? 'text-success-fg' : 'text-text-muted',
            )}
          >
            {changeOnLastWeek > 0 ? '+' : '−'}
            {formatMoney(Math.abs(changeOnLastWeek))} on last week
          </p>
        ) : null}
      </div>

      <dl className="flex border-t border-neutral-bg pt-3">
        {[
          { value: String(orders), label: orders === 1 ? 'order' : 'orders' },
          { value: formatMoney(average), label: 'average' },
          { value: String(items), label: 'items sold' },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-1 flex-col gap-0.5">
            <dt className="font-numeric text-base font-semibold">{stat.value}</dt>
            <dd className="text-[11.5px] text-text-muted">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RunningOut({
  products,
  loading,
}: {
  products: LowStockProduct[] | undefined;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-[164px] rounded-lg" />;

  return (
    <section className={cn(panel, 'flex flex-col overflow-hidden')}>
      <header className="flex items-center gap-2.5 border-b border-border bg-surface-sunken px-5 py-3">
        <h2 className="text-[13px] font-semibold">Running out</h2>
        {products && products.length > 0 ? (
          <span className="font-numeric inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-warning-border bg-warning-bg px-1.5 text-[11.5px] font-semibold text-warning-fg">
            {products.length}
          </span>
        ) : null}
        <Link
          to="/inventory"
          className="ml-auto text-[12.5px] font-medium text-accent transition-colors hover:text-accent-hover"
        >
          Open inventory
        </Link>
      </header>

      {!products || products.length === 0 ? (
        <p className="px-5 py-8 text-center text-small text-text-muted">
          Nothing is low or out right now.
        </p>
      ) : (
        products.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3.5 border-b border-neutral-bg px-5 py-3.5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="truncate text-xs text-text-muted">
                {[
                  product.category,
                  // Turns "3 left" into a reason to act. Absent until the
                  // product has actually sold something in the window.
                  product.sellsPerDay
                    ? `sells about ${Math.round(product.sellsPerDay)} a day`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>

            {product.stockQuantity === 0 ? (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-border bg-neutral-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-neutral-fg">
                <Ban className="size-3" aria-hidden />
                Out of stock
              </span>
            ) : (
              <span className="font-numeric ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning-border bg-warning-bg px-2.5 py-0.5 text-[11.5px] font-semibold text-warning-fg">
                <AlertTriangle className="size-3" aria-hidden />
                {product.stockQuantity} left
              </span>
            )}
          </div>
        ))
      )}
    </section>
  );
}

function Speed({
  stats,
  loading,
}: {
  stats: { speedToday: import('@/api/types').SpeedToday } | undefined;
  loading: boolean;
}) {
  if (loading || !stats) return <Skeleton className="h-[164px] rounded-lg" />;

  const { acceptedToPackedSeconds, packedToDeliveredSeconds, slowestSeconds, slowestOrderCode } =
    stats.speedToday;

  const rows = [
    { seconds: acceptedToPackedSeconds, label: 'order to packed', alert: false },
    { seconds: packedToDeliveredSeconds, label: 'packed to delivered', alert: false },
  ];

  return (
    <section className={cn(panel, 'flex flex-col gap-3 px-5 py-4')}>
      <h2 className="text-caption tracking-[0.08em] text-text-muted uppercase">
        How fast, today
      </h2>

      {acceptedToPackedSeconds === null && packedToDeliveredSeconds === null ? (
        <p className="py-4 text-small text-text-muted">
          Nothing delivered yet today — this fills in as orders complete.
        </p>
      ) : (
        <>
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline gap-2.5">
              <span className="font-numeric w-[58px] text-base font-semibold">
                {row.seconds === null ? '—' : formatDuration(row.seconds)}
              </span>
              <span className="text-[12.5px] text-text-secondary">{row.label}</span>
            </div>
          ))}

          {slowestSeconds !== null ? (
            <div className="flex items-baseline gap-2.5 border-t border-neutral-bg pt-3">
              <span className="font-numeric w-[58px] text-base font-semibold text-warning-fg">
                {formatDuration(slowestSeconds)}
              </span>
              <span className="text-[12.5px] text-text-secondary">
                slowest today{slowestOrderCode ? ` — ${slowestOrderCode}` : ''}
              </span>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
