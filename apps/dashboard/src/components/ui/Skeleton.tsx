import { cn } from '@/lib/cn';

/**
 * Skeletons, never spinners. A spinner hides how much is coming; a skeleton
 * holds the shape so the page does not jump when data lands.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-md bg-line-soft', className)}
    />
  );
}

/** Matching skeleton for a list row, so loading keeps the real rhythm. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-line-soft', className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-1 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-7.5 w-24 rounded-md" />
        </div>
      ))}
    </div>
  );
}
