import { Skeleton } from "@/components/ui/skeleton";

export default function ConversationDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-3 w-44" />
      <div className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-32" />
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-44" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={i % 2 === 0 ? "flex justify-start" : "flex justify-end"}>
            <Skeleton className="h-12 w-2/3 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
