import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, Boxes, Check, Inbox, Info, Package, Store, Truck, Wallet,
} from 'lucide-react';
import { fetchProducts } from '@/api/inventory';
import { queryKeys } from '@/api/keys';
import type { FulfillmentSummary } from '@/api/types';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Skeleton } from '@/components/ui/Skeleton';
import { useShopSettings, useUpdateShopSettings } from '@/features/settings/useShopSettings';
import { shopStatusMeta } from '@/features/settings/shopStatus';
import { nextAction } from '@/features/orders/lifecycle';
import { useAdvanceFulfillment, useFulfillments } from '@/features/orders/useOrders';
import { StatTile } from '@/features/stats/StatTile';
import { formatMoney, plural, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The landing screen answers one question: what needs me right now?
 *
 * Counts first, then the two things that can actually demand action — orders
 * to pack, orders to hand over — then stock about to run out. Nothing here is
 * merely interesting to look at; this is opened fifty times a day.
 */
/** The clay circle beside a panel title; muted when it is not the attention queue. */
function CountPill({ value, tone }: { value: number; tone?: 'attention' }) {
  return (
    <span
      className={cn(
        'font-numeric inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-[7px] text-xs font-semibold',
        tone === 'attention' ? 'bg-warning text-white' : 'bg-neutral-bg text-text-secondary',
      )}
    >
      {value}
    </span>
  );
}

function QueueRow({
  order,
  onOpen,
  onAdvance,
  pending,
}: {
  order: FulfillmentSummary;
  onOpen: (id: number) => void;
  onAdvance: (id: number, status: 'packed' | 'out_for_delivery') => void;
  pending: boolean;
}) {
  // Both panels here hold orders that still have a step left, and the wording
  // of that step depends on whether it leaves by van or over the counter.
  const action = nextAction(order.status, order.deliveryType);
  if (!action || action.status === 'delivered') return null;
  const next = action.status;

  return (
    <div className="flex items-center gap-4 border-b border-neutral-bg px-4 py-3.5 transition-colors duration-[120ms] last:border-b-0 hover:bg-surface-hover">
      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="flex w-[104px] shrink-0 flex-col gap-0.5 text-left"
      >
        <span className="font-code text-small">{order.orderCode}</span>
        <span className="text-xs text-text-muted">
          {order.acceptedAt ? timeAgo(order.acceptedAt) : '—'}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="flex min-w-0 flex-1 flex-col gap-1 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="truncate text-body font-semibold">
            {order.customer.displayName ?? order.customer.phone}
          </span>
          <Badge
            tone="neutral"
            icon={order.deliveryType === 'pickup' ? Store : Truck}
            className="capitalize"
          >
            {order.deliveryType.replace(/_/g, ' ')}
          </Badge>
        </span>
      </button>

      <div className="font-numeric shrink-0 text-right">
        <div className="text-h3">{formatMoney(order.subtotal)}</div>
        <div className="text-xs text-text-muted">{plural(order.itemCount, 'item')}</div>
      </div>

      <Button
        variant={next === 'packed' ? 'primary' : 'secondary'}
        loading={pending}
        onClick={() => onAdvance(order.id, next)}
      >
        {action.label}
      </Button>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const advance = useAdvanceFulfillment();

  /**
   * No stats endpoint — the backend's position (Q-D2) is to derive the figures
   * from the `counts` and `totals` blocks every list already returns. So these
   * two polled requests feed the tiles and the queues below them.
   */
  const waiting = useFulfillments({ status: 'accepted', limit: 5 });
  const packed = useFulfillments({ status: 'packed', limit: 5 });
  const counts = waiting.data?.counts;
  const totals = waiting.data?.totals;

  const { data: shop } = useShopSettings();
  const save = useUpdateShopSettings();
  const status = shop ? shopStatusMeta[shop.openState] : null;

  /** "Closes at 22:00 · 8h 12m left", while the shop is actually open. */
  const closingIn = (() => {
    if (!shop?.closingTime || shop.openState !== 'open') return null;

    const [h, m] = shop.closingTime.split(':').map(Number);
    const now = new Date();
    const minutes = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
    // Past midnight the window has wrapped; add a day rather than show a
    // negative countdown.
    const left = minutes > 0 ? minutes : minutes + 24 * 60;

    return `Closes at ${shop.closingTime} · ${Math.floor(left / 60)}h ${left % 60}m left`;
  })();

  const outOfStock = useQuery({
    queryKey: queryKeys.inventory({ stockState: 'out' }),
    queryFn: () => fetchProducts({ stockState: 'out' }),
  });
  const lowStock = useQuery({
    queryKey: queryKeys.inventory({ stockState: 'low' }),
    queryFn: () => fetchProducts({ stockState: 'low' }),
  });

  const gone = outOfStock.data?.data ?? [];
  const running = [...gone, ...(lowStock.data?.data ?? [])].slice(0, 5);

  const waitingRows = waiting.data?.data ?? [];
  const packedRows = packed.data?.data ?? [];
  const oldest = waitingRows[waitingRows.length - 1];

  const onAdvance = (id: number, status: 'packed' | 'out_for_delivery') =>
    advance.mutate({ id, status });

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <>
      {/* Freshness lives in one place — the shell's footer — rather than
          being repeated per page. Nothing here is manually refreshed: every
          query re-polls on its own. */}
      <PageHeader eyebrow={today} title="Today at the counter" />

      <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pb-[30px] md:px-9">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            label="New"
            icon={Inbox}
            value={counts?.accepted ?? 0}
            tone={(counts?.accepted ?? 0) > 0 ? 'alert' : 'default'}
            hint={
              oldest?.acceptedAt
                ? `oldest ${timeAgo(oldest.acceptedAt)}`
                : 'nothing waiting'
            }
            loading={waiting.isPending}
            onClick={() => navigate('/orders')}
          />
          <StatTile
            label="Packed"
            icon={Package}
            value={counts?.packed ?? 0}
            hint="waiting for the run"
            loading={waiting.isPending}
            onClick={() => navigate('/orders?status=packed')}
          />
          <StatTile
            label="Out"
            icon={Truck}
            value={counts?.out_for_delivery ?? 0}
            hint={
              counts?.out_for_delivery
                ? 'with the driver'
                : 'nothing with the driver'
            }
            loading={waiting.isPending}
            onClick={() => navigate('/orders?status=out_for_delivery')}
          />
          <StatTile
            label="Delivered"
            icon={Check}
            value={counts?.delivered ?? 0}
            hint="closed today"
            loading={waiting.isPending}
            onClick={() => navigate('/history')}
          />
          <StatTile
            label="Takings"
            icon={Wallet}
            value={formatMoney(totals?.deliveredRevenueToday ?? 0)}
            hint={
              totals ? `${formatMoney(totals.deliveredRevenue)} all time` : undefined
            }
            loading={waiting.isPending}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeader
              title={
                <span className="flex items-center gap-2">
                  Waiting to pack
                  {counts?.accepted ? <CountPill value={counts.accepted} tone="attention" /> : null}
                </span>
              }
              action={
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1 text-small font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  All orders
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />

            {waiting.isPending ? (
              <div className="flex flex-col gap-px p-4">
                {Array.from({ length: 2 }, (_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : waitingRows.length > 0 ? (
              waitingRows.map((order) => (
                <QueueRow
                  key={order.id}
                  order={order}
                  onOpen={(id) => navigate(`/orders/${id}`)}
                  onAdvance={onAdvance}
                  pending={advance.isPending && advance.variables?.id === order.id}
                />
              ))
            ) : (
              <EmptyState
                tone="calm"
                icon={<Package className="size-4.5" aria-hidden />}
                title="All caught up"
                description="Every order that has come in is already packed or on its way."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title={
                <span className="flex items-center gap-2">
                  Ready to hand over
                  {counts?.packed ? <CountPill value={counts.packed} /> : null}
                </span>
              }
              action={
                <Link
                  to="/orders?status=packed"
                  className="inline-flex items-center gap-1 text-small font-medium text-accent transition-colors hover:text-accent-hover"
                >
                  Packed
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />

            {packed.isPending ? (
              <div className="flex flex-col gap-px p-4">
                <Skeleton className="h-16" />
              </div>
            ) : packedRows.length > 0 ? (
              packedRows.map((order) => (
                <QueueRow
                  key={order.id}
                  order={order}
                  onOpen={(id) => navigate(`/orders/${id}`)}
                  onAdvance={onAdvance}
                  pending={advance.isPending && advance.variables?.id === order.id}
                />
              ))
            ) : (
              <EmptyState
                tone="calm"
                icon={<Package className="size-4.5" aria-hidden />}
                title="Nothing bagged"
                description="Orders you mark packed wait here for the delivery run."
              />
            )}
          </Panel>
          </div>

          <div className="flex flex-col gap-4">
        <Panel>
          <PanelHeader
            title="Running out"
            action={
              <Link
                to="/inventory"
                className="inline-flex items-center gap-1 text-small font-medium text-accent transition-colors hover:text-accent-hover"
              >
                Inventory
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />

          {running.length > 0 ? (
            running.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => navigate('/inventory')}
                className="flex w-full items-center gap-3 border-b border-neutral-bg px-4 py-3 text-left transition-colors duration-[120ms] last:border-b-0 hover:bg-surface-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">
                    {product.name}
                  </span>
                  <span className="block text-caption tracking-normal text-text-muted">
                    {product.category ?? '—'}
                    {product.inStock
                      ? product.localName
                        ? ` · your name: ${product.localName}`
                        : ''
                      : ' · hidden from customers until restocked'}
                  </span>
                </span>

                {product.inStock ? (
                  <Badge tone="warning">{product.stockQuantity} left</Badge>
                ) : (
                  <Badge tone="neutral">Out of stock</Badge>
                )}
              </button>
            ))
          ) : (
            <EmptyState
              tone="calm"
              icon={<Boxes className="size-4.5" aria-hidden />}
              title="Stock looks healthy"
              description="Nothing is low or out right now."
            />
          )}
        </Panel>

            {/* The shop, at a glance — state, remaining hours, and the way in
                to change either. */}
            {shop ? (
              <Panel>
                <PanelHeader title="The shop" />

                <div className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-body font-medium">Taking orders</p>
                      <p className="mt-0.5 font-numeric text-xs text-text-muted">
                        {closingIn ?? (status ? status.hint : '')}
                      </p>
                    </div>
                    <Toggle
                      checked={shop.isActive}
                      label="Taking orders"
                      disabled={save.isPending}
                      onChange={(isActive) => save.mutate({ isActive })}
                    />
                  </div>

                  <Button className="w-full" onClick={() => navigate('/settings')}>
                    Opening hours &amp; account
                  </Button>
                </div>
              </Panel>
            ) : null}

            {gone.length > 0 ? (
              <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-3.5 py-3">
                <Info className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden />
                <p className="text-small text-text-secondary">
                  <span className="font-semibold text-warning-fg">
                    {gone.length} {gone.length === 1 ? 'item is' : 'items are'} out of stock.
                  </span>{' '}
                  The assistant will stop offering {gone.length === 1 ? 'it' : 'them'} on
                  WhatsApp until you restock.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
