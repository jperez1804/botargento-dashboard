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

// 5-step ramp shown in the legend. Same formula as the cell color below
// (12% floor, scales to 95%) — purely visual reference, not interactive.
const LEGEND_STEPS = [0.15, 0.34, 0.53, 0.72, 0.95];

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
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between gap-3">
        <CardTitle className="text-[15px] font-semibold text-[var(--ink)]">
          Demanda por hora — últimos {windowDays} días
        </CardTitle>
        <div className="flex items-center gap-3 text-[12.5px] text-[var(--soft-ink)]">
          <span className="tabular-nums whitespace-nowrap">
            {formatNumber(total, locale)} mensajes {titleSuffix}
          </span>
          <select
            aria-label="Filtrar por intención"
            value={selectedIntent ?? ALL_OPTION}
            onChange={(e) => setIntent(e.target.value)}
            disabled={isPending}
            className="h-8 rounded-lg border border-[var(--rule-strong)] bg-[var(--surface)] px-2.5 text-[12.5px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[color-mix(in_oklch,var(--client-primary)_60%,transparent)] focus-visible:outline-offset-2"
          >
            <option value={ALL_OPTION}>Todas</option>
            {intents.map((intent) => (
              <option key={intent.key} value={intent.label}>
                {intent.label}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div
              className="grid gap-0.5 text-[10.5px] text-[var(--soft-ink)]"
              style={{ gridTemplateColumns: `32px repeat(24, minmax(0, 1fr))` }}
            >
              <div />
              {HOURS.map((h) => (
                <div key={`h-${h}`} className="text-center tabular-nums pb-1">
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

        {/* Legend strip — anchors the intensity ramp so operators can map a
          * cell tint back to its quintile at a glance. Anchored right so it
          * lines up with the rightmost cells. */}
        <div className="mt-4 flex items-center justify-between gap-3 px-1">
          <p className="text-[11px] text-[var(--soft-ink)]">
            Hora del tenant (America/Argentina/Buenos_Aires). Intensidad relativa al máximo de la ventana.
          </p>
          <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--soft-ink)] shrink-0">
            <span>menos</span>
            <div className="flex gap-0.5">
              {LEGEND_STEPS.map((v) => (
                <span
                  key={v}
                  className="size-3 rounded-[2px]"
                  style={{
                    backgroundColor: `color-mix(in oklch, var(--client-primary) ${Math.round(v * 100)}%, var(--surface))`,
                  }}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span>más</span>
          </div>
        </div>
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
      <div className="flex items-center justify-end pr-1.5 text-[11px] font-medium text-[var(--muted-ink)]">
        {label}
      </div>
      {counts.map((count, hour) => {
        const opacity = max > 0 ? count / max : 0;
        const isZero = count === 0;
        return (
          <div
            key={`${label}-${hour}`}
            title={`${label} ${hour.toString().padStart(2, "0")}:00 — ${formatNumber(count, locale)} mensajes`}
            className="aspect-square rounded-[3px]"
            style={{
              // Zero cells: canvas-2 fill + 1px rule border so they read as
              // "sampled, no messages" — distinct from "not in window".
              // Active cells: color-mix the tenant primary into SURFACE
              // (not transparent) so the ramp is well-defined in dark mode
              // too. 12% floor keeps the lightest cells visible.
              backgroundColor: isZero
                ? "var(--canvas-2)"
                : `color-mix(in oklch, var(--client-primary) ${Math.round(opacity * 83 + 12)}%, var(--surface))`,
              boxShadow: isZero ? "inset 0 0 0 1px var(--rule)" : undefined,
            }}
          />
        );
      })}
    </>
  );
}
