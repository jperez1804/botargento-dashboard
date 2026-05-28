import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-3 border-b border-[var(--rule)] pb-5">
        <Skeleton className="h-3.5 w-32" />
        <div className="flex items-end justify-between gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <ul className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] divide-y divide-[var(--rule)] overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="px-5 py-4 grid gap-2 sm:grid-cols-[1fr_auto] items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-5 w-56" />
            </div>
            <Skeleton className="h-3 w-32 sm:justify-self-end" />
          </li>
        ))}
      </ul>
    </div>
  );
}
