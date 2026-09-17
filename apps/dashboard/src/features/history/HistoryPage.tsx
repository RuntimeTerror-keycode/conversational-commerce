import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive } from 'lucide-react';
import type { FulfillmentStatus, FulfillmentSummary } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/features/orders/StatusBadge';
import { useFulfillments } from '@/features/orders/useOrders';
import { formatMoney, formatTime, plural } from '@/lib/format';
import { cn } from '@/lib/cn';
import { OrderDrawer } from '@/features/orders/OrderDrawer';

/**
 * Finished orders, kept apart from the live queue.
 *
 * The two are different jobs — one is work to do, the other a record to look
 * something up in. There are no action buttons here by design, and the header
 * says so, because an archive that looks editable invites people to try.
 */
type Filter = Extract<FulfillmentStatus, 'delivered' | 'rejected'>;

const PAGE = 20;

const grid =
  'grid grid-cols-[104px_minmax(0,1fr)_88px_88px_80px_88px_116px] items-center gap-4 px-6';

/** "Today · 17 September", "Wednesday · 16 September". */
function dayLabel(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const long = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
  if (sameDay(date, now)) return `Today · ${long}`;
  if (sameDay(date, yesterday)) return `Yesterday · ${long}`;

  const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });
  return `${weekday} · ${long}`;
}

function groupByDay(orders: FulfillmentSummary[]): Array<[string, FulfillmentSummary[]]> {
  const groups = new Map<string, FulfillmentSummary[]>();

  for (const order of orders) {
    const stamp = order.updatedAt ?? order.acceptedAt;
    if (!stamp) continue;
    const key = dayLabel(stamp);
    const bucket = groups.get(key);
    if (bucket) bucket.push(order);
    else groups.set(key, [order]);
  }

  return [...groups.entries()];
}

export function HistoryPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [limit, setLimit] = useState(PAGE);

  const param = searchParams.get('filter');
  const filter: Filter = param === 'rejected' ? 'rejected' : 'delivered';

  const { data, isPending, error, refetch, isPlaceholderData } = useFulfillments({
    status: filter,
    limit,
  });

  const setFilter = (value: Filter) => {
    setLimit(PAGE);
    setSearchParams(value === 'delivered' ? {} : { filter: value }, { replace: true });
  };

  const counts = data?.counts;
  const orders = data?.data ?? [];
  const total = data?.page.total ?? 0;
  const takings = orders.reduce((sum, order) => sum + order.subtotal, 0);

  const filters: SegmentItem<Filter>[] = [
    { value: 'delivered', label: 'Delivered', count: counts?.delivered },
    { value: 'rejected', label: 'Rejected', count: counts?.rejected },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Finished orders"
        title="Order history"
      />

      <div className="mx-auto flex max-w-content flex-col gap-[22px] px-4 pb-[30px] md:px-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented items={filters} value={filter} onChange={setFilter} />
          {orders.length > 0 ? (
            <span className="font-numeric text-small text-text-muted">
              {formatMoney(takings)} across {plural(orders.length, 'order')} shown
            </span>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <div
            className={cn(
              grid,
              'border-b border-border bg-surface-sunken py-2.5 text-caption text-text-muted uppercase',
            )}
          >
            <div>Order</div>
            <div>Customer</div>
            <div>Items</div>
            <div className="text-right">Total</div>
            <div>Placed</div>
            <div>Finished</div>
            <div>Status</div>
          </div>

          {isPending && !data ? (
            <div className="divide-y divide-neutral-bg">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className={cn(grid, 'py-3.5')}>
                  {Array.from({ length: 7 }, (_, cell) => (
                    <Skeleton key={cell} className="h-4" />
                  ))}
                </div>
              ))}
            </div>
          ) : error ? (
            <ErrorState title="Could not load history" onRetry={() => void refetch()} />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Archive className="size-4.5" aria-hidden />}
              title="No orders here yet"
              description={
                filter === 'delivered'
                  ? 'Completed orders are kept here once they are delivered.'
                  : 'Nothing has been rejected.'
              }
            />
          ) : (
            <div className={isPlaceholderData ? 'opacity-50 transition-opacity' : undefined}>
              {groupByDay(orders).map(([day, rows]) => (
                <section key={day}>
                  <h2 className="border-b border-border bg-surface-sunken px-6 py-2 text-caption tracking-[0.08em] text-text-muted uppercase">
                    {day}
                  </h2>

                  {rows.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => navigate(`/history/${order.id}`)}
                      className={cn(
                        grid,
                        'w-full border-b border-neutral-bg py-3.5 text-left last:border-b-0',
                        'transition-colors duration-[120ms] hover:bg-surface-hover',
                      )}
                    >
                      <span
                        className={cn(
                          'font-code text-small',
                          order.status === 'rejected' && 'text-text-disabled',
                        )}
                      >
                        {order.orderCode}
                      </span>
                      <span className="truncate text-body font-medium">
                        {order.customer.displayName ?? order.customer.phone}
                      </span>
                      <span className="font-numeric text-small text-text-muted">
                        {plural(order.itemCount, 'item')}
                      </span>
                      <span className="font-numeric text-right text-body font-semibold">
                        {formatMoney(order.subtotal)}
                      </span>
                      <span className="font-numeric text-small text-text-muted">
                        {order.acceptedAt ? formatTime(order.acceptedAt) : '—'}
                      </span>
                      <span className="font-numeric text-small text-text-muted">
                        {order.updatedAt ? formatTime(order.updatedAt) : '—'}
                      </span>
                      <span>
                        <StatusBadge status={order.status} />
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}

          {orders.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-sunken px-6 py-3">
              <span className="font-numeric text-small text-text-muted">
                Showing {orders.length} of {total} finished orders
              </span>
              {data?.page.hasMore ? (
                <Button onClick={() => setLimit((current) => current + PAGE)}>
                  Load {PAGE} more
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <OrderDrawer
        orderId={orderId ? Number(orderId) : null}
        onClose={() => navigate('/history')}
      />
    </>
  );
}
