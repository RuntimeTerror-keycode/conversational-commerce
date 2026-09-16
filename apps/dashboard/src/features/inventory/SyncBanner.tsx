import { PencilLine, RefreshCw } from 'lucide-react';
import type { Retailer } from '@/api/types';
import { timeAgo } from '@/lib/format';

/**
 * External shops run their own POS. We hold a synced copy, decrement nothing,
 * and show it read-only — an edit here would be overwritten by the next sync,
 * so the honest thing is not to offer one.
 */
export function SyncBanner({ retailer }: { retailer: Retailer }) {
  if (retailer.inventoryMode === 'managed') {
    return (
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-xs">
        <PencilLine className="size-3.5 shrink-0 text-text-disabled" aria-hidden />
        <p className="text-small text-text-secondary">
          You manage this inventory here — stock comes down automatically as orders
          arrive.
        </p>
      </div>
    );
  }

  const sync = retailer.sync;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-xs">
      <RefreshCw className="size-3.5 shrink-0 text-text-disabled" aria-hidden />
      <p className="text-small text-text-secondary">
        Synced from <span className="font-medium text-text">{sync?.provider ?? 'your billing system'}</span>
        {sync?.lastSyncedAt ? ` · ${timeAgo(sync.lastSyncedAt)}` : ''}
      </p>
      <span className="text-caption text-text-disabled">Read-only here — edit it in your system.</span>
    </div>
  );
}
