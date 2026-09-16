import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Boxes, PartyPopper, TriangleAlert } from 'lucide-react';
import { fetchStats } from '@/api/stats';
import { fetchProducts } from '@/api/inventory';
import { queryKeys } from '@/api/keys';
import { PageHeader } from '@/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LiveDot } from '@/components/ui/LiveDot';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { useSession } from '@/features/auth/useSession';
import { OrderRow } from '@/features/orders/OrderRow';
import { useOrders } from '@/features/orders/useOrders';
import { StatTile } from '@/features/stats/StatTile';
import { formatMoney } from '@/lib/format';

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * The landing screen answers one question: what needs me right now?
 *
 * Figures first, then the two things that can actually demand action — orders
 * waiting to be packed, and stock that has run out. Anything that is merely
 * interesting to look at is left off; this is opened fifty times a day.
 */
export function DashboardPage() {
  const navigate = useNavigate();
  const session = useSession();

  const stats = useQuery({
    queryKey: queryKeys.stats,
    queryFn: fetchStats,
    refetchInterval: 15_000,
  });

  const newOrders = useOrders({ status: ['accepted'], limit: 5 });

  const lowStock = useQuery({
    queryKey: queryKeys.inventory({ stockState: 'low' }),
    queryFn: () => fetchProducts({ stockState: 'low' }),
  });

  const outOfStock = useQuery({
    queryKey: queryKeys.inventory({ stockState: 'out' }),
    queryFn: () => fetchProducts({ stockState: 'out' }),
  });

  const name = session.data?.user.name;
  const attention = lowStock.data?.data ?? [];
  const gone = outOfStock.data?.data ?? [];
  const stockIssues = [...gone, ...attention].slice(0, 5);

  return (
    <>
      <PageHeader
        title={name ? `${greeting(new Date())}, ${name}` : 'Dashboard'}
        subtitle="Here is what needs you right now"
        actions={<LiveDot state={newOrders.error ? 'stale' : 'live'} />}
      />

      <div className="flex flex-col gap-5 px-5 py-5 md:px-7">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Waiting to pack"
            value={stats.data?.newOrders ?? 0}
            tone={(stats.data?.newOrders ?? 0) > 0 ? 'alert' : 'default'}
            hint={stats.data?.newOrders ? 'Needs action' : 'All caught up'}
            loading={stats.isPending}
            onClick={() => navigate('/orders')}
          />
          <StatTile
            label="In progress"
            value={stats.data?.activeOrders ?? 0}
            hint="Packed or on the way"
            loading={stats.isPending}
            onClick={() => navigate('/orders?filter=in_progress')}
          />
          <StatTile
            label="Delivered today"
            value={stats.data?.completedToday ?? 0}
            loading={stats.isPending}
            onClick={() => navigate('/history')}
          />
          <StatTile
            label="Revenue today"
            value={formatMoney(stats.data?.revenue ?? 0)}
            hint="Delivered orders"
            loading={stats.isPending}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Panel>
            <PanelHeader
              title="Waiting to pack"
              action={
                <Link
                  to="/orders"
                  className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  All orders
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />

            {newOrders.isPending ? (
              <SkeletonRows rows={3} />
            ) : newOrders.data && newOrders.data.data.length > 0 ? (
              <div className="divide-y divide-line-soft">
                {newOrders.data.data.map((order, index) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    index={index}
                    onOpen={(id) => navigate(`/orders/${id}`)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                tone="calm"
                icon={<PartyPopper className="size-4.5" aria-hidden />}
                title="All caught up"
                description="Every order that has come in is already packed or on its way."
              />
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Stock to watch"
              action={
                <Link
                  to="/inventory"
                  className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  Inventory
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              }
            />

            {stockIssues.length > 0 ? (
              <div className="divide-y divide-line-soft">
                {stockIssues.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigate('/inventory')}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">
                        {product.name}
                      </span>
                      <span className="block text-xs text-ink-3">{product.category}</span>
                    </span>

                    {product.inStock ? (
                      <Badge tone="new" dot>
                        {product.stockQuantity} left
                      </Badge>
                    ) : (
                      <Badge tone="bad" dot>
                        Out
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                tone="calm"
                icon={<Boxes className="size-4.5" aria-hidden />}
                title="Stock looks healthy"
                description="Nothing is low or out right now."
              />
            )}
          </Panel>
        </div>

        {gone.length > 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-bad-line bg-bad-soft px-3.5 py-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-bad">
                {gone.length} {gone.length === 1 ? 'item is' : 'items are'} out of stock.
              </span>{' '}
              The assistant will stop offering {gone.length === 1 ? 'it' : 'them'} on
              WhatsApp until you restock.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
