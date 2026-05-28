import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ConversationDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-3.5 w-32" />
        <span aria-hidden="true" className="text-[var(--rule-strong)]">
          /
        </span>
        <Skeleton className="h-3.5 w-24" />
      </div>

      {/* Two-column layout matching the loaded state */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_300px]">
        <section className="min-w-0 space-y-4 lg:order-1 order-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* Thread bubbles skeleton — alternating sides, varying widths */}
          <div className="space-y-2 pt-3">
            <div className="flex justify-center py-3">
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
            {[
              { side: "start", w: 220 },
              { side: "end", w: 280 },
              { side: "start", w: 180 },
              { side: "end", w: 240 },
              { side: "start", w: 320 },
              { side: "end", w: 200 },
            ].map((row, i) => (
              <div key={i} className={row.side === "start" ? "flex justify-start" : "flex justify-end"}>
                <Skeleton className="h-14 rounded-xl" style={{ width: row.w }} />
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="px-5 py-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </aside>
      </div>
    </div>
  );
}
