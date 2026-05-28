"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatSignedPercent } from "@/lib/format";
import type { KpiFormat } from "@/config/verticals/_types";

type Props = {
  label: string;
  value: number;
  previousValue: number;
  format: KpiFormat;
  higherIsBetter: boolean;
  locale: string;
  // Optional string that replaces the big numeric display (e.g. an intent name
  // for the leading-intent card). The numeric `value` is still used for delta
  // math and shown in `valueCaption` if provided.
  display?: string;
  valueCaption?: string;
  // Tiny mono kicker rendered under the value, used to surface a hidden
  // dependency (e.g. "Según: Último interés" when the value depends on a
  // selector elsewhere on the page). Stays visually subordinate to
  // `valueCaption`.
  meta?: string;
};

type DeltaTone = "positive" | "danger" | "neutral";

type DeltaState = {
  direction: "up" | "down" | "flat";
  pctChange: number | null; // null when previous was 0 (undefined %)
};

function computeDelta(current: number, previous: number): DeltaState {
  if (previous === 0 && current === 0) return { direction: "flat", pctChange: 0 };
  if (previous === 0) return { direction: "up", pctChange: null };
  const pct = (current - previous) / previous;
  if (Math.abs(pct) < 0.005) return { direction: "flat", pctChange: 0 };
  return { direction: pct > 0 ? "up" : "down", pctChange: pct };
}

// Tone is derived from direction + whether higher-is-better for the metric.
// Flat / no-change is always neutral, regardless of preferred direction.
function toneFor(direction: DeltaState["direction"], higherIsBetter: boolean): DeltaTone {
  if (direction === "flat") return "neutral";
  return (direction === "up") === higherIsBetter ? "positive" : "danger";
}

const TONE_CHIP: Record<DeltaTone, string> = {
  positive: "bg-[var(--positive-soft)] text-[var(--positive)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  neutral: "bg-[var(--neutral-soft)] text-[var(--muted-ink)]",
};

const TONE_DOT: Record<DeltaTone, string> = {
  positive: "bg-[var(--positive)]",
  danger: "bg-[var(--danger)]",
  neutral: "bg-[var(--soft-ink)]",
};

export function KpiCard({
  label,
  value,
  previousValue,
  format,
  higherIsBetter,
  locale,
  display,
  valueCaption,
  meta,
}: Props) {
  const formattedValue =
    format === "percent" ? formatPercent(value, locale) : formatNumber(value, locale);
  const bigDisplay = display ?? formattedValue;

  const delta = computeDelta(value, previousValue);
  const tone = toneFor(delta.direction, higherIsBetter);

  const deltaText =
    delta.pctChange === null
      ? "Nuevo"
      : delta.direction === "flat"
        ? "Sin cambios"
        : formatSignedPercent(delta.pctChange, locale);

  return (
    <Card>
      <CardContent className="px-5 py-4 flex flex-col gap-1.5 min-w-0">
        {/* Caption: 11 px / 500 / uppercase / 0.08em tracking / soft-ink */}
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)]">
          {label}
        </div>

        {/* Value or display string. Tabular-nums on the numeric variant so KPI
         * cards in a row align column-wise. Display variant (intent name)
         * uses proportional figures since it's text, not numbers. */}
        <div
          className={cn(
            "font-semibold tracking-[-0.02em] leading-[1.1] text-[var(--ink)]",
            display ? "text-[26px]" : "text-[28px] tabular-nums",
          )}
        >
          {bigDisplay}
        </div>

        {valueCaption ? (
          <div className="text-[12.5px] text-[var(--soft-ink)]">{valueCaption}</div>
        ) : null}

        {meta ? (
          <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
            {meta}
          </div>
        ) : null}

        {/* Delta chip + comparison helper. Tone derives from direction +
         * higherIsBetter; the comparison string stays soft-ink. */}
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--soft-ink)] mt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 h-[18px] px-1.5 rounded-full text-[11px] font-medium tabular-nums",
              TONE_CHIP[tone],
            )}
          >
            <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
            {deltaText}
          </span>
          <span>vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
