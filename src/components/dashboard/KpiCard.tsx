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

export function KpiCard({ label, value, previousValue, format, higherIsBetter, locale }: Props) {
  const display =
    format === "percent" ? formatPercent(value, locale) : formatNumber(value, locale);

  const delta = computeDelta(value, previousValue);

  const goodDirection =
    delta.direction === "flat"
      ? "neutral"
      : (delta.direction === "up") === higherIsBetter
        ? "good"
        : "bad";

  const deltaColor =
    goodDirection === "good"
      ? "text-[#059669]"
      : goodDirection === "bad"
        ? "text-[#dc2626]"
        : "text-[#6b7280]";

  const Icon =
    delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;

  const deltaText =
    delta.pctChange === null
      ? "Nuevo"
      : delta.direction === "flat"
        ? "Sin cambios"
        : formatSignedPercent(delta.pctChange, locale);

  return (
    <Card className="ring-1 ring-black/5">
      <CardContent className="px-5 py-4 space-y-2">
        <div className="text-xs font-medium text-[#6b7280] uppercase tracking-wide">
          {label}
        </div>
        <div className="font-[var(--font-geist-sans)] text-[36px] leading-none font-semibold tabular-nums">
          {display}
        </div>
        <div className={cn("flex items-center gap-1 text-xs", deltaColor)}>
          <Icon className="size-3.5" aria-hidden="true" />
          <span>{deltaText}</span>
          <span className="text-[#9ca3af]">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
