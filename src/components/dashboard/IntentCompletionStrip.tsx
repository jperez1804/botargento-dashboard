import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { IntentCompletionRate } from "@/lib/queries/intents";

type Props = {
  rows: ReadonlyArray<IntentCompletionRate>;
  locale: string;
  windowDays: number;
};

export function IntentCompletionStrip({ rows, locale, windowDays }: Props) {
  const visible = rows.filter((row) => row.started > 0);
  if (visible.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[var(--ink)]">
          Finalización de flujos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-[var(--rule)] text-sm">
          {visible.map((row) => (
            <li
              key={row.intent}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="text-[var(--ink)]">{row.intent}</span>
              <span className="flex items-center gap-3 text-xs text-[var(--muted-ink)] tabular-nums">
                <span>{formatNumber(row.started, locale)} contactos</span>
                <span className="text-[var(--ink)] font-medium">
                  {row.rate === null ? "—" : formatPercent(row.rate, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--soft-ink)]">
          % de contactos en cada intención que llegaron al paso terminal del flujo en los últimos{" "}
          {windowDays} días. {'"—"'} indica que el flujo no tiene un paso terminal definido.
        </p>
      </CardContent>
    </Card>
  );
}
