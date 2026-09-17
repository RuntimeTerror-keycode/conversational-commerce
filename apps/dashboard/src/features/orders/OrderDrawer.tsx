import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MapPin, MessageSquare, Phone, Truck, X } from 'lucide-react';
import type { DashboardTransition } from '@/api/types';
import { Button, IconButton } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDateTime, formatMoney, formatTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ActivityFeed } from './ActivityFeed';
import { LifecycleStepper } from './LifecycleStepper';
import { StatusBadge } from './StatusBadge';
import { nextAction } from './lifecycle';
import { useAdvanceFulfillment, useFulfillment } from './useOrders';

/** Section label — 11px caps, wide tracking, muted. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-caption tracking-[0.1em] text-text-muted uppercase">
      {children}
    </div>
  );
}

interface OrderDrawerProps {
  orderId: number | null;
  onClose: () => void;
}

export function OrderDrawer({ orderId, onClose }: OrderDrawerProps) {
  const { data: order, isPending, error, refetch } = useFulfillment(orderId);
  const advance = useAdvanceFulfillment();

  const action = order ? nextAction(order.status, order.delivery.type) : null;
  const sourceLines = (order?.items ?? [])
    .map((line) => line.sourceText)
    .filter((text): text is string => Boolean(text));

  const onAdvance = (status: DashboardTransition) => {
    if (!order) return;
    advance.mutate({ id: order.id, status });
  };

  return (
    <Dialog.Root open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-fade-in fixed inset-0 z-40 bg-[rgb(26_25_22_/_0.24)]" />

        <Dialog.Content
          className={cn(
            'data-[state=open]:animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-full max-w-[648px] flex-col',
            'border-l border-border bg-surface',
            'shadow-[-24px_0_48px_-24px_rgb(26_25_22_/_0.35)]',
          )}
        >
          <header className="flex shrink-0 flex-col gap-3 border-b border-border px-6.5 pt-5 pb-4.5">
            <div className="flex items-center gap-3">
              {order ? (
                <>
                  <Dialog.Title className="font-code text-xl font-medium">
                    {order.orderCode}
                  </Dialog.Title>
                  <StatusBadge status={order.status} />
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-sunken py-[3px] pr-[9px] pl-[7px] text-[11.5px] font-medium text-text-secondary capitalize">
                    <Truck className="size-3" aria-hidden />
                    {order.delivery.type.replace(/_/g, " ")}
                  </span>
                </>
              ) : (
                <Skeleton className="h-6 w-28" />
              )}

              <Dialog.Close asChild>
                <IconButton label="Close order" variant="bare" className="ml-auto">
                  <X className="size-[17px]" aria-hidden />
                </IconButton>
              </Dialog.Close>
            </div>

            {order ? <LifecycleStepper order={order} /> : null}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isPending ? (
              <div className="flex flex-col gap-4 p-6.5">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error || !order ? (
              <ErrorState
                title="Could not load this order"
                onRetry={() => void refetch()}
              />
            ) : (
              <>
                {/*
                  What the customer actually sent. `sourceText` lives per line
                  on the API and is currently always null, so the block is
                  absent rather than showing an empty quote — and appears on
                  its own the day the backend populates it.
                */}
                {sourceLines.length > 0 ? (
                  <section className="flex flex-col gap-2.5 border-b border-neutral-bg px-6.5 py-4.5">
                    <SectionLabel>
                      <MessageSquare className="size-3.5" aria-hidden />
                      What{' '}
                      {order.customer.displayName ?? 'the customer'} sent
                    </SectionLabel>

                    <div className="flex flex-col gap-1.5 rounded-[10px_10px_10px_4px] border border-border bg-surface-sunken px-3.5 py-3">
                      <p className="text-base leading-[1.5]">{sourceLines.join(', ')}</p>
                      <p className="font-numeric text-[11.5px] text-text-muted">
                        WhatsApp
                        {order.timeline.acceptedAt
                          ? ` · ${formatTime(order.timeline.acceptedAt)}`
                          : ''}
                      </p>
                    </div>
                  </section>
                ) : null}

                <section className="flex flex-col gap-3.5 border-b border-neutral-bg px-6.5 pt-4.5 pb-4">
                  <SectionLabel>Items</SectionLabel>

                  {order.items.map((line, index) => (
                    <div
                      key={line.lineId}
                      className={cn(
                        'flex items-start gap-4',
                        index > 0 && 'border-t border-dashed border-neutral-bg pt-3.5',
                      )}
                    >
                      <div className="flex min-w-0 grow flex-col gap-1">
                        <p className="text-[15px] font-semibold">{line.productName}</p>
                        <p className="text-[12.5px] text-text-muted">
                          {[line.catalogName !== line.productName ? line.catalogName : null]
                            .filter(Boolean)
                            .join(' · ') || line.unit}
                        </p>
                      </div>

                      <div className="font-numeric shrink-0 text-right">
                        <p className="text-small text-text-secondary">
                          {line.quantity} × {formatMoney(line.unitPrice)}
                        </p>
                        <p className="text-base font-semibold">
                          {formatMoney(line.lineTotal)}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>

                {/* One figure. There is no delivery fee on a fulfillment, so an
                    "Items" line would only ever repeat the total back. */}
                <section className="flex items-baseline justify-between border-b border-neutral-bg bg-canvas px-6.5 py-3.5">
                  <span className="text-body font-semibold">Total</span>
                  <span className="font-numeric text-[26px] font-medium">
                    {formatMoney(order.subtotal)}
                  </span>
                </section>

                <section className="grid grid-cols-2 gap-5 border-b border-neutral-bg px-6.5 py-4">
                  <div className="flex flex-col gap-[7px]">
                    <SectionLabel>Customer</SectionLabel>
                    <p className="text-body font-semibold">
                      {order.customer.displayName ?? order.customer.phone}
                    </p>
                    <a
                      href={`tel:${order.customer.phone}`}
                      className="font-numeric inline-flex items-center gap-[7px] text-small text-accent hover:text-accent-hover"
                    >
                      <Phone className="size-3.5" aria-hidden />
                      {order.customer.phone}
                    </a>
                  </div>

                  <div className="flex flex-col gap-[7px]">
                    <SectionLabel>
                      {order.delivery.type === 'pickup' ? 'Pickup' : 'Deliver to'}
                    </SectionLabel>
                    {/* A pickup carries the customer's home address too, but
                        nobody is driving there — showing it would read as a
                        delivery instruction. */}
                    {order.delivery.type !== 'pickup' && order.delivery.address ? (
                      <p className="flex items-start gap-2 text-small text-text-secondary">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-text-disabled" aria-hidden />
                        <span>
                          {[order.delivery.address, order.delivery.city]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </p>
                    ) : (
                      <p className="text-small text-text-muted">
                        {order.delivery.type === 'pickup'
                          ? 'Collected at the counter'
                          : 'No address on the order'}
                      </p>
                    )}
                    {order.delivery.note ? (
                      <p className="text-[12.5px] text-text-muted italic">
                        “{order.delivery.note}”
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="flex flex-col gap-3 px-6.5 py-4">
                  <SectionLabel>Activity</SectionLabel>
                  <ActivityFeed events={order.events} />
                  <p className="font-numeric pt-1 text-caption tracking-normal text-text-disabled">
                    {order.timeline.acceptedAt
                      ? `Accepted ${formatDateTime(order.timeline.acceptedAt)}`
                      : ''}
                    {order.traceId ? ` · ${order.traceId}` : ''}
                  </p>
                </section>
              </>
            )}
          </div>

          {order ? (
            <footer className="shrink-0 border-t border-border bg-canvas px-6.5 py-4">
              {action ? (
                <Button
                  variant="primary"
                  className="w-full"
                  loading={advance.isPending}
                  onClick={() => onAdvance(action.status)}
                >
                  {action.label}
                </Button>
              ) : (
                <p className="text-center text-small text-text-muted">
                  {order.status === 'delivered' ? 'Order complete' : 'No further action'}
                </p>
              )}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
