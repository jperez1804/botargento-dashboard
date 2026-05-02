import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatNumber } from "@/lib/format";
import type { IntentTimeToHandoff as IntentTimeToHandoffRow } from "@/lib/queries/intents";

type Props = {
  rows: ReadonlyArray<IntentTimeToHandoffRow>;
  locale: string;
  windowDays: number;
};

export function IntentTimeToHandoff({ rows, locale, windowDays }: Props) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[var(--ink)]">
          Tiempo hasta derivación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--soft-ink)]">
                <th className="py-1 pr-4 font-medium">Intención</th>
                <th className="py-1 pr-4 font-medium">Mediana</th>
                <th className="py-1 pr-4 font-medium">p90</th>
                <th className="py-1 text-right font-medium">n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)] text-[13px]">
              {rows.map((row) => (
                <tr key={row.intent}>
                  <td className="py-2 pr-4 text-[var(--ink)]">{row.intent}</td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--ink)]">
                    {row.medianSeconds === null
                      ? "—"
                      : formatDuration(row.medianSeconds, locale)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-[var(--muted-ink)]">
                    {row.p90Seconds === null ? "—" : formatDuration(row.p90Seconds, locale)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--muted-ink)]">
                    {formatNumber(row.sampleSize, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-[var(--soft-ink)]">
          Tiempo en reloj real desde el primer mensaje del contacto hasta la derivación durante los
          últimos {windowDays} días, incluye horario no laboral. Buckets con n &lt; 5 muestran
          &quot;—&quot; para evitar medianas engañosas con muestras pequeñas.
        </p>
      </CardContent>
    </Card>
  );
}
