import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { formatAutomationLabel } from "@/lib/automation-labels";
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
  return hit?.label ?? formatAutomationLabel(target) ?? target;
}

export function HandoffSummaryCards({ rows, targets, locale }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-ink)]">
        No hay derivaciones registradas todavía.
      </div>
    );
  }
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <Card key={row.target}>
          <CardContent className="px-5 py-4 space-y-2">
            <div className="text-[10px] font-medium text-[var(--muted-ink)] uppercase tracking-[0.14em] font-[var(--font-geist-mono)] truncate">
              {friendlyName(row.target, targets)}
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-[32px] leading-none font-semibold tabular-nums font-[var(--font-fraunces)] tracking-tight text-[var(--ink)]">
                {formatNumber(row.count_24h, locale)}
              </div>
              <div className="text-xs text-[var(--muted-ink)]">en las últimas 24h</div>
            </div>
            <div className="text-xs text-[var(--soft-ink)] tabular-nums">
              {formatNumber(row.count_all_time, locale)} en total
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
