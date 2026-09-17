import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, PackageCheck, RefreshCw } from 'lucide-react';
import { ApiRequestError } from '@/api/client';
import type { DashboardTransition, FulfillmentSummary } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LiveDot } from '@/components/ui/LiveDot';
import { Segmented, type SegmentItem } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { formatMoney, formatTime, plural, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { OrderDrawer } from './OrderDrawer';
import { ProgressTrack } from './ProgressTrack';
import { stageMeta } from './stageMeta';
import { useAdvanceFulfillment, useFulfillments } from './useOrders';

/**
 * The work queue.
 *
 * One tab per stage, because `GET /api/fulfillments?status=` takes a single
 * value and 422s a comma list — and because three explicit stages read more
 * clearly than a lumped "in progress" anyway.
 *
 * Laid out as a real table rather than a card list: a shopkeeper scanning
 * thirty orders wants the money in one column and the age in another, which
 * cards cannot give them.
 */
const tabStatuses = ['accepted', 'packed', 'out_for_delivery'] as const;
type Tab = (typeof tabStatuses)[number];

/** Matches the column rhythm on every row, header and skeleton. */
const grid =
  'grid grid-cols-[112px_minmax(0,1fr)_176px_104px_124px_172px] items-center gap-4 px-[22px]';

function isTab(value: string | null): value is Tab {
  return value !== null && (tabStatuses as readonly string[]).includes(value);
}

function Row({
  order,
  action,
  onOpen,
  onAdvance,
  pending,
}: {
  order: FulfillmentSummary;
  action: string;
  onOpen: (id: number) => void;
  onAdvance: (id: number, status: DashboardTransition) => void;
  pending: boolean;
}) {
  const next: Record<string, DashboardTransition> = {
    accepted: 'packed',
    packed: 'out_for_delivery',
    out_for_delivery: 'delivered',
  };
  const target = next[order.status];

  return (
    <div
      className={cn(
        grid,
        'animate-fade-in border-b border-neutral-bg py-4 last:border-b-0',
        'transition-colors duration-[120ms] hover:bg-surface-hover',
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="flex flex-col items-start gap-0.5 text-left"
      >
        <span className="font-code text-small">{order.orderCode}</span>
        <span className="text-caption tracking-normal text-text-muted capitalize">
          {order.deliveryType.replace(/_/g, ' ')}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="flex min-w-0 flex-col gap-1 text-left"
      >
        <span className="truncate text-[15px] font-semibold">
          {order.customer.displayName ?? order.customer.phone}
        </span>
        <span className="truncate text-small text-text-secondary">
          {plural(order.itemCount, 'item')}
        </span>
      </button>

      <ProgressTrack status={order.status} />

      <div className="text-right">
        <div className="font-numeric text-h3">{formatMoney(order.subtotal)}</div>
        <div className="font-numeric text-caption tracking-normal text-text-muted">
          {plural(order.itemCount, 'item')}
        </div>
      </div>

      <div className="text-small text-text-muted">
        {order.acceptedAt ? timeAgo(order.acceptedAt) : '—'}
      </div>

      <div className="flex justify-end">
        {target ? (
          <Button
            variant="primary"
            loading={pending}
            onClick={() => onAdvance(order.id, target)}
          >
            {action}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const param = searchParams.get('status');
  const tab: Tab = isTab(param) ? param : 'accepted';
  const stage = stageMeta[tab];
  const advance = useAdvanceFulfillment();

  const { data, isPending, isFetching, error, refetch, isPlaceholderData } =
    useFulfillments({ status: tab });

  const setTab = (value: Tab) =>
    setSearchParams(value === 'accepted' ? {} : { status: value }, { replace: true });

  const onAdvance = (id: number, status: DashboardTransition) => {
    advance.mutate(
      { id, status },
      {
        onSuccess: (updated) =>
          toast(`${updated.orderCode} moved to ${updated.status.replace(/_/g, ' ')}`, 'success'),
        onError: (mutationError) =>
          // A 409 means somebody else already moved it — two tabs, two devices.
          // The refetch has already corrected the row, so this is a note, not an alarm.
          toast(
            mutationError instanceof ApiRequestError && mutationError.isConflict
              ? 'That order was already updated somewhere else.'
              : 'Could not update the order. Try again.',
            'error',
          ),
      },
    );
  };

  const counts = data?.counts;
  const orders = data?.data ?? [];

  const tabs: SegmentItem<Tab>[] = [
    { value: 'accepted', label: 'New', count: counts?.accepted, tone: 'attention' },
    { value: 'packed', label: 'Packed', count: counts?.packed },
    {
      value: 'out_for_delivery',
      label: 'Out for delivery',
      count: counts?.out_for_delivery,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="The work queue"
        title="Orders"
        actions={
          <>
            <LiveDot state={error ? 'stale' : 'live'} />
            <IconButton
              label="Refresh list"
              onClick={() => void refetch()}
              className="border border-border-strong bg-surface"
            >
              <RefreshCw
                className={cn('size-4', isFetching && 'animate-spin')}
                aria-hidden
              />
            </IconButton>
          </>
        }
      />

      <div className="mx-auto flex max-w-content flex-col gap-[22px] px-4 pb-[30px] md:px-9">
        <Segmented items={tabs} value={tab} onChange={setTab} />

        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {/* Stage banner — teaches the model to a first-time user. */}
          <div className="flex items-center gap-2.5 border-b border-border bg-surface-sunken px-[22px] py-3">
            <Badge tone={stage.tone}>{stage.label}</Badge>
            <span className="text-small text-text-secondary">{stage.hint}</span>
          </div>

          <div
            className={cn(
              grid,
              'border-b border-border py-2.5 text-caption text-text-muted uppercase',
            )}
          >
            <div>Order</div>
            <div>Customer</div>
            <div>Progress</div>
            <div className="text-right">Total</div>
            <div>Placed</div>
            <div />
          </div>

          <div aria-live="polite" aria-busy={isPending}>
            {isPending && !data ? (
              <div className="divide-y divide-neutral-bg">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className={cn(grid, 'py-4')}>
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-2.5" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-4" />
                    <Skeleton className="h-11" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <ErrorState
                title="Could not load orders"
                message="The dashboard cannot reach the server. It will keep trying."
                onRetry={() => void refetch()}
              />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<PackageCheck className="size-4.5" aria-hidden />}
                title={stage.emptyTitle}
                description={stage.emptyBody}
                action={
                  tab !== 'accepted' && counts?.accepted ? (
                    <Button onClick={() => setTab('accepted')}>
                      Go to New
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className={isPlaceholderData ? 'opacity-50 transition-opacity' : undefined}>
                {orders.map((order) => (
                  <Row
                    key={order.id}
                    order={order}
                    action={stage.action}
                    onOpen={(id) => navigate(`/orders/${id}`)}
                    onAdvance={onAdvance}
                    pending={advance.isPending && advance.variables?.id === order.id}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-sunken px-[22px] py-2.5 text-caption tracking-normal text-text-muted">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'size-[7px] shrink-0 rounded-full',
                  error ? 'bg-text-disabled' : 'bg-accent',
                )}
                aria-hidden
              />
              <span className="font-numeric">
                {error
                  ? 'Not updating'
                  : data
                    ? `Updated ${formatTime(data.serverTime)}`
                    : 'Updating…'}
              </span>
            </span>
            <span className="font-numeric">{plural(orders.length, 'order')}</span>
          </div>
        </div>
      </div>

      <OrderDrawer
        orderId={orderId ? Number(orderId) : null}
        onClose={() => navigate('/orders')}
      />
    </>
  );
}
