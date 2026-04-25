import { TableSkeleton } from "@/components/dashboard/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-md border border-[#e5e7eb] bg-white p-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      <TableSkeleton rows={10} />
    </div>
  );
}
