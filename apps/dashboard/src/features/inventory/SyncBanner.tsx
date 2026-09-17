import { RefreshCw } from 'lucide-react';
import type { SessionShop } from '@/api/types';

/**
 * External shops run their own POS. We hold a synced copy, decrement nothing,
 * and show it read-only — an edit here would be overwritten by the next sync,
 * so the honest thing is not to offer one.
 *
 * Managed shops get no banner at all: the table's own footer already explains
 * how stock behaves, and a standing notice above it is just noise.
 */
export function SyncBanner({ shop }: { shop: SessionShop }) {
  if (shop.inventoryMode === 'managed') return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-surface px-3.5 py-2.5">
      <RefreshCw className="size-3.5 shrink-0 text-text-disabled" aria-hidden />
      <p className="text-small text-text-secondary">Synced from your billing system.</p>
      <span className="text-caption tracking-normal text-text-disabled">
        Read-only here — edit it in your system.
      </span>
    </div>
  );
}
