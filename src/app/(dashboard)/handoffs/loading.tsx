import { Skeleton } from "@/components/ui/skeleton";
import { StripSkeleton, TableSkeleton } from "@/components/dashboard/skeletons";

export default function HandoffsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-3 border-b border-[var(--rule)] pb-5">
        <Skeleton className="h-3 w-20" />
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      {/* Section labels + skeletons */}
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-44" />
        <StripSkeleton />
      </div>

      <div className="space-y-2.5">
        <Skeleton className="h-3 w-36" />
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}
