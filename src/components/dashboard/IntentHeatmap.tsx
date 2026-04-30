"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { IntentHeatmapCell } from "@/lib/queries/intents";
import type { IntentDef } from "@/config/verticals/_types";

const DOW_LABELS_MON_FIRST = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
// Postgres EXTRACT(DOW) returns 0=Sun..6=Sat. Remap to a Monday-first row order
// (LATAM convention): row index = (postgresDow + 6) % 7.
const DOW_TO_ROW = (dow: number) => (dow + 6) % 7;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ALL_OPTION = "todas";

type Props = {
  data: ReadonlyArray<IntentHeatmapCell>;
  intents: ReadonlyArray<IntentDef>;
  selectedIntent: string | null; // null when "Todas"
  locale: string;
  windowDays: number;
};

export function IntentHeatmap({ data, intents, selectedIntent, locale, windowDays }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setIntent(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_OPTION) params.delete("heatmapIntent");
    else params.set("heatmapIntent", value);
    startTransition(() => {
      router.replace(`?${params.toString()}`, { scroll: false });
    });
  }

  const grid: number[][] = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  let max = 0;
  for (const cell of data) {
    const row = DOW_TO_ROW(cell.dow);
    if (row < 0 || row > 6 || cell.hour < 0 || cell.hour > 23) continue;
    const rowArr = grid[row];
    if (!rowArr) continue;
    rowArr[cell.hour] = cell.count;
    if (cell.count > max) max = cell.count;
  }

  const total = data.reduce((acc, c) => acc + c.count, 0);
  const titleSuffix = selectedIntent ? `· ${selectedIntent}` : "· Todas las intenciones";

  return (
    <Card className="ring-1 ring-black/5">
      <CardHeader className="pb-2 flex-row items-center justify-between gap-3">
        <CardTitle className="text-base font-semibold">
          Demanda por hora — últimos {windowDays} días
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-[#6b7280]">
          <select
            aria-label="Filtrar por intención"
            value={selectedIntent ?? ALL_OPTION}
            onChange={(e) => setIntent(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs text-[#374151]"
          >
            <option value={ALL_OPTION}>Todas</option>
            {intents.map((intent) => (
              <option key={intent.key} value={intent.label}>
                {intent.label}
              </option>
            ))}
          </select>
          <span className="tabular-nums whitespace-nowrap">
            {formatNumber(total, locale)} mensajes {titleSuffix}
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div
              className="grid gap-px text-[10px] text-[#9ca3af]"
              style={{ gridTemplateColumns: `32px repeat(24, minmax(0, 1fr))` }}
            >
              <div />
              {HOURS.map((h) => (
                <div key={`h-${h}`} className="text-center tabular-nums">
                  {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
                </div>
              ))}
              {DOW_LABELS_MON_FIRST.map((label, row) => (
                <ContiguousRow
                  key={label}
                  label={label}
                  counts={grid[row] ?? []}
                  max={max}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#9ca3af]">
          Hora del tenant ({"America/Argentina/Buenos_Aires"}). Intensidad relativa al máximo de la
          ventana.
        </p>
      </CardContent>
    </Card>
  );
}

function ContiguousRow({
  label,
  counts,
  max,
  locale,
}: {
  label: string;
  counts: number[];
  max: number;
  locale: string;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-1 font-medium text-[#374151]">{label}</div>
      {counts.map((count, hour) => {
        const opacity = max > 0 ? count / max : 0;
        return (
          <div
            key={`${label}-${hour}`}
            title={`${label} ${hour.toString().padStart(2, "0")}:00 — ${formatNumber(count, locale)} mensajes`}
            className="aspect-square rounded-[2px]"
            style={{
              backgroundColor:
                count === 0
                  ? "#f3f4f6"
                  : `color-mix(in oklab, var(--client-primary, #3b82f6) ${Math.max(15, Math.round(opacity * 100))}%, transparent)`,
            }}
          />
        );
      })}
    </>
  );
}
