import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Archive, Search } from 'lucide-react';
import type { VisibleOrderStatus } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { OrderDrawer } from '@/features/orders/OrderDrawer';
import { OrderRow } from '@/features/orders/OrderRow';
import { useOrders } from '@/features/orders/useOrders';
import { formatMoney, plural } from '@/lib/format';
import { cn } from '@/lib/cn';

type Filter = 'delivered' | 'rejected' | 'all';

/**
 * Finished orders, kept apart from the live queue.
 *
 * The two are different jobs — one is work to do, the other is a record to
 * look something up in. Folding them into one tabbed list is what makes an
 * orders screen read as a database table rather than a shop's work surface.
 * There are no action buttons here by design.
 */
const filterStatuses: Record<Filter, VisibleOrderStatus[]> = {
  delivered: ['delivered'],
  rejected: ['rejected'],
  all: ['delivered', 'rejected'],
};

export function HistoryPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const filter = (searchParams.get('filter') as Filter | null) ?? 'delivered';

  const { data, isPending, error, refetch, isPlaceholderData } = useOrders({
    status: filterStatuses[filter],
    q: search || undefined,
    limit: 50,
  });

  const setFilter = (value: Filter) => {
    setSearchParams(value === 'delivered' ? {} : { filter: value }, { replace: true });
  };

  const counts = data?.counts;
  const orders = data?.data ?? [];
  const takings = orders.reduce(
    (sum, order) => (order.status === 'delivered' ? sum + order.total : sum),
    0,
  );

  const filters: SegmentItem<Filter>[] = [
    { value: 'delivered', label: 'Delivered', count: counts?.delivered },
    { value: 'rejected', label: 'Rejected', count: counts?.rejected },
    { value: 'all', label: 'All' },
  ];

  return (
    <>
      <PageHeader
        title="Order history"
        subtitle={
          orders.length > 0 ? (
            <span className="tnum">
              {plural(orders.length, 'order')} · {formatMoney(takings)} delivered
            </span>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented items={filters} value={filter} onChange={setFilter} />

          <div className="w-full sm:w-64">
            <Input
              placeholder="Search past orders"
              aria-label="Search order history"
              leading={<Search className="size-3.5" aria-hidden />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Panel>
          {isPending && !data ? (
            <SkeletonRows rows={5} />
          ) : error ? (
            <ErrorState
              title="Could not load history"
              onRetry={() => void refetch()}
            />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<Archive className="size-4.5" aria-hidden />}
              title={search ? 'Nothing matches that search' : 'No orders here yet'}
              description={
                search
                  ? 'Try a different name, order number, or item.'
                  : 'Completed orders are kept here once they are delivered.'
              }
            />
          ) : (
            <div
              className={cn(
                'divide-y divide-line-soft transition-opacity duration-200',
                isPlaceholderData ? 'opacity-50' : 'opacity-100',
              )}
            >
              {orders.map((order, index) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  index={index}
                  onOpen={(id) => navigate(`/history/${id}`)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <OrderDrawer orderId={orderId ?? null} onClose={() => navigate('/history')} />
    </>
  );
}
