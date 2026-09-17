import { cn } from '@/lib/cn';

/**
 * Skeletons, never spinners. A spinner hides how much is coming; a skeleton
 * holds the shape so the page does not jump when data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-md bg-surface-sunken', className)}
    />
  );
}

/** Matching skeleton for an order/list row, so loading keeps the real rhythm. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-border', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-1 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Matches the inventory table's real column widths (Product / Category /
 * Price / Stock / Availability / Updated) — DESIGN_SYSTEM §7 requires the
 * loading table to hold the same shape as the loaded one so nothing shifts.
 */
export function SkeletonTable({ rows = 7, editable = true }: { rows?: number; editable?: boolean }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="h-4 w-14" />
          {editable ? <Skeleton className="h-4 w-14" /> : null}
          <Skeleton className="h-6 w-20 rounded-sm" />
          <Skeleton className="hidden h-4 w-16 xl:block" />
        </div>
      ))}
    </div>
  );
}
