import { ChevronRight } from 'lucide-react';
import type { OrderSummary, ShopkeeperTransition } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { formatMoney, plural, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StatusBadge, statusRail } from './StatusBadge';
import { nextAction } from './lifecycle';

interface OrderRowProps {
  order: OrderSummary;
  onOpen: (orderId: string) => void;
  onAdvance?: (orderId: string, status: ShopkeeperTransition) => void;
  pending?: boolean;
  /** Staggers the entry animation down the list. */
  index?: number;
}

export function OrderRow({ order, onOpen, onAdvance, pending, index = 0 }: OrderRowProps) {
  const action = onAdvance ? nextAction(order.status) : null;
  const isNew = order.status === 'accepted';

  return (
    <div
      className={cn(
        'animate-slide-up group relative flex items-stretch gap-3.5 pr-3',
        'transition-colors duration-150',
        isNew ? 'bg-warning-bg/30 hover:bg-warning-bg/50' : 'hover:bg-surface-hover',
      )}
      // Capped so a full page of orders never takes more than a beat to settle.
      style={{ animationDelay: `${Math.min(index, 8) * 28}ms` }}
    >
      {/* Status rail. Colour-coded, but the badge carries the same meaning in
          words — colour is never the only signal. */}
      <span className={cn('w-1 shrink-0', statusRail[order.status])} aria-hidden />

      <button
        type="button"
        onClick={() => onOpen(order.id)}
        className="flex min-w-0 flex-1 items-center gap-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-numeric text-body font-semibold">{order.orderCode}</span>
            <StatusBadge status={order.status} />
            <span className="text-caption whitespace-nowrap text-text-disabled">
              {timeAgo(order.placedAt)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 text-small text-text-secondary">
            <span className="truncate font-medium">
              {order.customer.displayName ?? order.customer.ref}
            </span>
            <span className="text-text-disabled" aria-hidden>·</span>
            <span className="font-numeric whitespace-nowrap text-text-muted">
              {plural(order.itemCount, 'item')}
            </span>
          </div>

          {/*
            docs/contracts.md §C3 rule 3 — the customer's own words, visible
            without opening the order. It is the single best on-screen proof
            the assistant understood something, so it gets a real treatment
            rather than a grey aside.
          */}
          {order.firstLineSourceText ? (
            <p className="mt-1.5 truncate text-caption text-text-muted italic">
              “{order.firstLineSourceText}”
            </p>
          ) : null}
        </div>

        <span className="font-numeric shrink-0 text-h3">{formatMoney(order.total)}</span>
      </button>

      {/* Fixed width so the price column stays aligned down the list — the
          action labels differ in length ("Mark packed" vs "Out for delivery")
          and a ragged money column is the first thing that reads as unfinished. */}
      <div className={cn('flex shrink-0 items-center justify-end', onAdvance ? 'w-32' : 'w-6')}>
        {action && onAdvance ? (
          <Button
            size="sm"
            variant={isNew ? 'primary' : 'secondary'}
            loading={pending}
            onClick={() => onAdvance(order.id, action.status)}
          >
            {action.label}
          </Button>
        ) : (
          <ChevronRight
            className="size-4 text-text-disabled opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
