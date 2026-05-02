"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
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

  const goodDirection =
    delta.direction === "flat"
      ? "neutral"
      : (delta.direction === "up") === higherIsBetter
        ? "good"
        : "bad";

  const deltaColor =
    goodDirection === "good"
      ? "text-[var(--good)]"
      : goodDirection === "bad"
        ? "text-[var(--bad)]"
        : "text-[var(--muted-ink)]";

  const Icon =
    delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;

  const deltaText =
    delta.pctChange === null
      ? "Nuevo"
      : delta.direction === "flat"
        ? "Sin cambios"
        : formatSignedPercent(delta.pctChange, locale);

  return (
    <Card>
      <CardContent className="px-5 py-4 space-y-2">
        <div className="text-[10px] font-medium text-[var(--muted-ink)] uppercase tracking-[0.14em] font-[var(--font-geist-mono)]">
          {label}
        </div>
        <div
          className={cn(
            "font-semibold tabular-nums text-[var(--ink)]",
            display
              ? "text-[26px] leading-tight font-[var(--font-fraunces)] tracking-tight"
              : "text-[40px] leading-none font-[var(--font-fraunces)] tracking-tight",
          )}
        >
          {bigDisplay}
        </div>
        {valueCaption ? (
          <div className="text-xs text-[var(--muted-ink)]">{valueCaption}</div>
        ) : null}
        {meta ? (
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--soft-ink)] font-[var(--font-geist-mono)]">
            {meta}
          </div>
        ) : null}
        <div className={cn("flex items-center gap-1 text-xs", deltaColor)}>
          <Icon className="size-3.5" aria-hidden="true" />
          <span className="tabular-nums">{deltaText}</span>
          <span className="text-[var(--soft-ink)]">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
