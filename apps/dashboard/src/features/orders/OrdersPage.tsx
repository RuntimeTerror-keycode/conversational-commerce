import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PartyPopper, Search } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { ShopkeeperTransition, VisibleOrderStatus } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { LiveDot } from '@/components/ui/LiveDot';
import { Panel } from '@/components/ui/Panel';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { OrderDrawer } from './OrderDrawer';
import { OrderRow } from './OrderRow';
import { useAdvanceOrder, useOrders } from './useOrders';

type Filter = 'new' | 'in_progress' | 'all';

/**
 * A work queue, not a decision inbox.
 *
 * Orders auto-accept and only appear here once they have, so there is no
 * triage step. `New` means arrived-and-untouched and its count is the badge
 * (docs/contracts.md §C3 rule 5, adapted). Completed orders live on /history —
 * mixing finished records into a work queue is what makes these screens feel
 * like a database viewer.
 */
const filterStatuses: Record<Filter, VisibleOrderStatus[]> = {
  new: ['accepted'],
  in_progress: ['packed', 'out_for_delivery'],
  all: ['accepted', 'packed', 'out_for_delivery'],
};

export function OrdersPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [search, setSearch] = useState('');

  const filter = (searchParams.get('filter') as Filter | null) ?? 'new';
  const advance = useAdvanceOrder();

  const { data, isPending, error, refetch, isPlaceholderData } = useOrders({
    status: filterStatuses[filter],
    q: search || undefined,
  });

  const setFilter = (value: Filter) => {
    setSearchParams(value === 'new' ? {} : { filter: value }, { replace: true });
  };

  const onAdvance = (id: string, status: ShopkeeperTransition) => {
    advance.mutate(
      { orderId: id, status },
      {
        onSuccess: (updated) => {
          toast(`${updated.orderCode} moved to ${updated.status.replace(/_/g, ' ')}`, 'success');
        },
        onError: (mutationError) => {
          // A 409 means somebody else already moved it — two tabs, two devices.
          // Not worth shouting about; the refetch has already corrected the row.
          toast(
            mutationError instanceof ApiRequestError && mutationError.isConflict
              ? 'That order was already updated somewhere else.'
              : 'Could not update the order. Try again.',
            'error',
          );
        },
      },
    );
  };

  const counts = data?.counts;
  const inProgress = counts ? counts.packed + counts.out_for_delivery : undefined;

  const filters: SegmentItem<Filter>[] = [
    { value: 'new', label: 'New', count: counts?.accepted, tone: 'new' },
    { value: 'in_progress', label: 'In progress', count: inProgress },
    { value: 'all', label: 'All active' },
  ];

  const orders = data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={
          counts ? (
            <span className="tnum">
              {counts.accepted} waiting · {inProgress} in progress
            </span>
          ) : null
        }
        actions={<LiveDot state={error ? 'stale' : 'live'} />}
      />

      <div className="flex flex-col gap-4 px-5 py-5 md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented items={filters} value={filter} onChange={setFilter} />

          <div className="w-full sm:w-64">
            <Input
              placeholder="Search orders"
              aria-label="Search orders"
              leading={<Search className="size-3.5" aria-hidden />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <Panel>
          {/* aria-live so a screen reader hears new orders arriving. */}
          <div aria-live="polite" aria-busy={isPending}>
            {isPending && !data ? (
              <SkeletonRows rows={4} />
            ) : error ? (
              <ErrorState
                title="Could not load orders"
                message="The dashboard cannot reach the server. It will keep trying."
                onRetry={() => void refetch()}
              />
            ) : orders.length === 0 ? (
              <EmptyState
                tone={filter === 'new' ? 'calm' : 'neutral'}
                icon={<PartyPopper className="size-4.5" aria-hidden />}
                title={
                  search
                    ? 'Nothing matches that search'
                    : filter === 'new'
                      ? 'All caught up'
                      : 'Nothing in progress'
                }
                description={
                  search
                    ? 'Try a different name, order number, or item.'
                    : filter === 'new'
                      ? 'New WhatsApp orders land here the moment they arrive.'
                      : 'Orders you have packed will show up here.'
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
                    onOpen={(id) => navigate(`/orders/${id}`)}
                    onAdvance={onAdvance}
                    pending={advance.isPending && advance.variables?.orderId === order.id}
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <OrderDrawer orderId={orderId ?? null} onClose={() => navigate('/orders')} />
    </>
  );
}

