// One panel of the Resumen: rows of "label · bar · count · %" (the
// IntentCompletionStrip pattern, generalised). Used for priority, team
// workload and origin; the bar color can follow the row's tone.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";

export type BreakdownRow = { key: string; label: string; count: number; pct: number; barClass?: string };

type Props = {
  title: string;
  description?: string;
  rows: ReadonlyArray<BreakdownRow>;
  locale: string;
  testId?: string;
  empty?: string;
};

export function BreakdownList({ title, description, rows, locale, testId, empty }: Props) {
  const total = rows.reduce((n, r) => n + r.count, 0);
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[var(--ink)]">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {total === 0 && empty ? (
          <p className="py-4 text-center text-[12.5px] text-[var(--faint-ink)]">{empty}</p>
        ) : (
          <ul className="divide-y divide-[var(--rule)] text-[13px]">
            {rows.map((r) => (
              <li key={r.key} data-row={r.key} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,1.4fr)_auto] items-center gap-3 py-2 first:pt-0 last:pb-0">
                <span className="truncate text-[var(--ink)]">{r.label}</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--neutral-soft)]" aria-hidden>
                  <span
                    className={cn("block h-full rounded-full", r.barClass ?? "bg-[var(--client-primary)]")}
                    style={{ width: `${Math.round(r.pct * 100)}%` }}
                  />
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-medium text-[var(--ink)]" data-count>
                    {formatNumber(r.count, locale)}
                  </span>
                  <span className="w-10 text-right text-[12px] text-[var(--soft-ink)]">
                    {formatPercent(r.pct, locale, 0)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
