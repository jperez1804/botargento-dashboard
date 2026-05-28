// Reusable skeleton building blocks for loading.tsx files. Server-rendered.

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="px-5 py-4 space-y-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ height = 260 }: { height?: number }) {
  return (
    <Card>
      <CardContent className="px-5 py-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="w-full" style={{ height }} />
      </CardContent>
    </Card>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)] overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="px-5 py-4 flex items-center gap-4">
          <Skeleton className="h-[22px] w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="hidden sm:block h-3 w-28" />
        </li>
      ))}
    </ul>
  );
}

// Matches the compact destination strip in HandoffSummaryCards — single
// card wrapper with a 4-up grid of cells (2-up on mobile). 8 cells.
export function StripSkeleton({ cells = 8 }: { cells?: number }) {
  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: cells }).map((_, i) => {
          const sep =
            (i % 2 !== 0 ? "border-l " : "") +
            (Math.floor(i / 2) > 0 ? "border-t " : "") +
            "md:border-l-0 md:border-t-0 " +
            (i % 4 !== 0 ? "md:border-l " : "") +
            (Math.floor(i / 4) > 0 ? "md:border-t " : "");
          return (
            <div
              key={i}
              className={`px-4 py-3.5 flex flex-col gap-1.5 min-w-0 border-[var(--rule)] ${sep}`}
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-28" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Matches the new HandoffsTable layout — single card with header band +
// row hairlines + footer band.
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] overflow-hidden">
      {/* Header band */}
      <div className="px-5 py-3 bg-[var(--surface-2)] border-b border-[var(--rule)] grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-5 py-3.5 border-b border-[var(--rule)] last:border-b-0 grid grid-cols-5 gap-4 items-center"
        >
          <Skeleton className="h-[22px] w-24 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
      ))}
      {/* Footer */}
      <div className="px-5 py-3 bg-[var(--surface-2)] border-t border-[var(--rule)] flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
    </div>
  );
}
