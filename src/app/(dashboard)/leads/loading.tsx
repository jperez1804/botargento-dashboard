import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function LeadsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-full max-w-[420px]" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[30px] w-24 rounded-full" />
        ))}
      </div>
      <TableSkeleton rows={10} />
    </div>
  );
}
