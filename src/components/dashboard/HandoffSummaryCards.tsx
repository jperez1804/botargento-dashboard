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
      <div className="rounded-xl border border-[var(--rule)] bg-[var(--surface)] p-6 text-sm text-[var(--muted-ink)]">
        No hay derivaciones registradas todavía.
      </div>
    );
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map((row) => (
        <Card key={row.target}>
          <CardContent className="px-5 py-4 flex flex-col gap-1.5 min-w-0">
            {/* Same caption treatment as KpiCard — 11 px uppercase soft-ink. */}
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] truncate">
              {friendlyName(row.target, targets)}
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[26px] font-semibold tabular-nums tracking-[-0.02em] leading-[1.1] ${
                  row.count_24h > 0 ? "text-[var(--ink)]" : "text-[var(--faint-ink)]"
                }`}
              >
                {formatNumber(row.count_24h, locale)}
              </span>
              <span className="text-[12px] text-[var(--soft-ink)] tabular-nums">
                de {formatNumber(row.count_all_time, locale)} totales
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
