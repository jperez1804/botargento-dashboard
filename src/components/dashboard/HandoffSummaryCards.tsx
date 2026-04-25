import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { HandoffSummaryRow } from "@/lib/queries/handoffs";
import type { HandoffTargetDef } from "@/config/verticals/_types";

type Props = {
  rows: ReadonlyArray<HandoffSummaryRow>;
  targets: ReadonlyArray<HandoffTargetDef>;
  locale: string;
};

function friendlyName(target: string, defs: ReadonlyArray<HandoffTargetDef>): string {
  const lower = target.toLowerCase();
  const hit = defs.find((d) => lower.includes(d.match.toLowerCase()));
  return hit?.label ?? target;
}

export function HandoffSummaryCards({ rows, targets, locale }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No hay derivaciones registradas todavía.
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.target} className="ring-1 ring-black/5">
          <CardContent className="px-5 py-4 space-y-2">
            <div className="text-xs font-medium text-[#6b7280] uppercase tracking-wide truncate">
              {friendlyName(row.target, targets)}
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-[28px] leading-none font-semibold tabular-nums">
                {formatNumber(row.count_24h, locale)}
              </div>
              <div className="text-xs text-[#6b7280]">en las últimas 24h</div>
            </div>
            <div className="text-xs text-[#9ca3af] tabular-nums">
              {formatNumber(row.count_all_time, locale)} en total
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
