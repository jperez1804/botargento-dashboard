import {
  ChartCardSkeleton,
  KpiGridSkeleton,
  ListSkeleton,
} from "@/components/dashboard/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>
      <KpiGridSkeleton />
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
