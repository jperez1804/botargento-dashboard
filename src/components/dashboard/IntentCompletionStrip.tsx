import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { IntentCompletionRate } from "@/lib/queries/intents";

type Props = {
  rows: ReadonlyArray<IntentCompletionRate>;
  locale: string;
};

export function IntentCompletionStrip({ rows, locale }: Props) {
  const visible = rows.filter((row) => row.started > 0);
  if (visible.length === 0) return null;

  return (
    <Card className="ring-1 ring-black/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Finalización de flujos</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-[#e5e7eb] text-sm">
          {visible.map((row) => (
            <li
              key={row.intent}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <span className="text-[#374151]">{row.intent}</span>
              <span className="flex items-center gap-3 text-xs text-[#6b7280] tabular-nums">
                <span>{formatNumber(row.started, locale)} contactos</span>
                <span className="text-[#374151] font-medium">
                  {row.rate === null ? "—" : formatPercent(row.rate, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[#9ca3af]">
          % de contactos en cada intención que llegaron al paso terminal del flujo en los últimos 7
          días. {'"—"'} indica que el flujo no tiene un paso terminal definido.
        </p>
      </CardContent>
    </Card>
  );
}
