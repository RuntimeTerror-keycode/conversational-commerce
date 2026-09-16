import type { ReactNode } from 'react';
import { MapPin, Phone, Wallet } from 'lucide-react';
import type { ShopkeeperTransition } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney } from '@/lib/format';
import { ActivityFeed } from './ActivityFeed';
import { LifecycleStepper } from './LifecycleStepper';
import { StatusBadge } from './StatusBadge';
import { nextAction } from './lifecycle';
import { useAdvanceOrder, useOrder } from './useOrders';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-caption font-semibold text-text-muted uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface OrderDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

export function OrderDrawer({ orderId, onClose }: OrderDrawerProps) {
  const { data: order, isPending, error, refetch } = useOrder(orderId);
  const advance = useAdvanceOrder();

  const action = order ? nextAction(order.status) : null;

  const onAdvance = (status: ShopkeeperTransition) => {
    if (!order) return;
    advance.mutate({ orderId: order.id, status });
  };

  return (
    <Drawer
      open={Boolean(orderId)}
      onClose={onClose}
      title={
        order ? (
          <div className="flex items-center gap-2.5">
            <span className="font-numeric text-h3">{order.orderCode}</span>
            <StatusBadge status={order.status} />
          </div>
        ) : (
          <Skeleton className="h-6 w-28" />
        )
      }
      footer={
        action ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={advance.isPending}
            onClick={() => onAdvance(action.status)}
          >
            {action.label}
          </Button>
        ) : order ? (
          <p className="text-center text-small text-text-muted">
            {order.status === 'delivered' ? 'Order complete' : 'No further action'}
          </p>
        ) : undefined
      }
    >
      {isPending ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error || !order ? (
        <ErrorState title="Could not load this order" onRetry={() => void refetch()} />
      ) : (
        <div className="flex flex-col gap-7">
          <LifecycleStepper order={order} />

          <Section title="Items">
            <div className="overflow-hidden rounded-lg border border-border">
              {order.items.map((line) => (
                <div
                  key={line.lineId}
                  className="flex items-start gap-3 border-b border-border px-3.5 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium">{line.productName}</p>

                    {/* The customer's own phrasing, on every line. §C3 rule 3. */}
                    {line.sourceText ? (
                      <p className="mt-0.5 text-caption text-text-muted italic">
                        “{line.sourceText}”
                      </p>
                    ) : null}

                    {line.substitutedFor ? (
                      <Badge tone="info" className="mt-1.5">
                        Replaced {line.substitutedFor.productName}
                      </Badge>
                    ) : null}

                    {line.availability === 'out_of_stock' ? (
                      <Badge tone="danger" className="mt-1.5">
                        Out of stock
                      </Badge>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-numeric text-body font-medium">
                      {formatMoney(line.lineTotal)}
                    </p>
                    <p className="font-numeric text-caption text-text-disabled">
                      {line.quantity} × {formatMoney(line.unitPrice)}
                    </p>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between bg-canvas px-3.5 py-3">
                <span className="text-body font-semibold">Total</span>
                <span className="font-numeric text-h3">{formatMoney(order.total)}</span>
              </div>
            </div>
          </Section>

          <Section title="Customer">
            <div className="flex flex-col gap-2.5 rounded-lg border border-border px-3.5 py-3">
              <p className="text-body font-medium">
                {order.customer.displayName ?? order.customer.ref}
              </p>

              {order.customer.phone ? (
                <a
                  href={`tel:${order.customer.phone}`}
                  className="flex items-center gap-2 text-small text-text-secondary hover:text-text"
                >
                  <Phone className="size-3.5 shrink-0 text-text-disabled" aria-hidden />
                  <span className="font-numeric">{order.customer.phone}</span>
                </a>
              ) : null}

              {order.delivery.address ? (
                <p className="flex items-start gap-2 text-small text-text-secondary">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-text-disabled" aria-hidden />
                  <span>
                    {order.delivery.address}
                    {order.delivery.note ? (
                      <span className="mt-0.5 block text-caption text-text-muted italic">
                        “{order.delivery.note}”
                      </span>
                    ) : null}
                  </span>
                </p>
              ) : null}

              <p className="flex items-center gap-2 text-small text-text-secondary">
                <Wallet className="size-3.5 shrink-0 text-text-disabled" aria-hidden />
                <span className="uppercase">{order.payment.method}</span>
                <Badge tone={order.payment.status === 'paid' ? 'success' : 'neutral'}>
                  {order.payment.status}
                </Badge>
              </p>
            </div>
          </Section>

          <Section title="Activity">
            <ActivityFeed events={order.events} />
          </Section>

          <p className="font-numeric border-t border-border pt-4 text-caption text-text-disabled">
            Placed {formatDateTime(order.placedAt)}
            {order.traceId ? ` · ${order.traceId}` : ''}
          </p>
        </div>
      )}
    </Drawer>
  );
}
