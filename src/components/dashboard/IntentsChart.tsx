"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPercent, formatSignedPercent } from "@/lib/format";
import { normalizeAutomationToken } from "@/lib/automation-labels";
import type { IntentCount, IntentHandoffRate } from "@/lib/queries/intents";
import type { IntentDef } from "@/config/verticals/_types";

const FALLBACK_COLOR = "#94a3b8";
const HANDOFF_RATE_TOLERANCE = 0.1;

type Props = {
  data: ReadonlyArray<IntentCount>;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
  title?: string;
  summarySuffix?: string;
  tooltipLabel?: string;
  // When provided, renders a per-intent handoff-rate chip strip below the chart
  // plus the attribution disclaimer. Rates use last-inbound-intent attribution
  // and intentionally do not sum to the global handoff-rate KPI.
  handoffRates?: ReadonlyArray<IntentHandoffRate>;
  // Same shape as `data`, scoped to the immediately-prior window of equal
  // length. Used to render a per-bucket delta arrow next to each bar.
  previousData?: ReadonlyArray<IntentCount>;
  // Per-bucket engagement density (messages ÷ unique contacts) for the same
  // window. Surfaces as a chip strip below the bars. Useful on the volume
  // chart to answer "how chatty is each flow per person?".
  engagementDensity?: ReadonlyArray<{ intent: string; perContact: number }>;
};

type DeltaState = {
  direction: "up" | "down" | "flat" | "new";
  pctChange: number | null;
};

function bucketDelta(current: number, previous: number): DeltaState | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0 && current > 0) return { direction: "new", pctChange: null };
  if (current === 0 && previous > 0) return { direction: "down", pctChange: -1 };
  const pct = (current - previous) / previous;
  if (Math.abs(pct) < 0.005) return { direction: "flat", pctChange: 0 };
  return { direction: pct > 0 ? "up" : "down", pctChange: pct };
}

type HandoffChipTone = "good" | "bad" | "neutral";

function chipToneFor(rate: number, desired: number | undefined): HandoffChipTone {
  if (desired === undefined) return "neutral";
  if (rate >= desired - HANDOFF_RATE_TOLERANCE) return "good";
  return "bad";
}

const CHIP_CLASSES: Record<HandoffChipTone, string> = {
  good: "bg-[#E6F4EA] text-[#1B5E20]",
  bad: "bg-[#F4CCCC] text-[#8A1A1A]",
  neutral: "bg-[var(--canvas)] text-[var(--muted-ink)]",
};

export function IntentsChart({
  data,
  intents,
  locale,
  title = "Contactos por intención",
  summarySuffix = "contactos únicos por intención en 7 días",
  tooltipLabel = "Contactos",
  handoffRates,
  previousData,
  engagementDensity,
}: Props) {
  // Server data is already deduped into business labels. The chart only folds
  // labels that match configured vertical buckets and leaves new labels visible.
  const byKey = new Map<string, IntentDef>();
  for (const i of intents) byKey.set(i.key.toLowerCase(), i);
  const byLabel = new Map<string, IntentDef>();
  for (const i of intents) byLabel.set(i.label.toLowerCase(), i);
  const counts = new Map<string, number>();
  for (const def of intents) counts.set(def.key, 0);
  const dynamicLabels = new Map<string, string>();
  for (const row of data) {
    const label = row.intent.trim();
    if (!label) continue;

    const key = label.toLowerCase();
    const def = byKey.get(key) ?? byLabel.get(key);
    if (def) {
      counts.set(def.key, (counts.get(def.key) ?? 0) + row.count);
    } else {
      const normalizedKey = normalizeAutomationToken(label);
      dynamicLabels.set(normalizedKey, label);
      counts.set(normalizedKey, (counts.get(normalizedKey) ?? 0) + row.count);
    }
  }
  const previousCounts = new Map<string, number>();
  if (previousData) {
    for (const def of intents) previousCounts.set(def.key, 0);
    for (const row of previousData) {
      const label = row.intent.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const def = byKey.get(key) ?? byLabel.get(key);
      if (def) {
        previousCounts.set(def.key, (previousCounts.get(def.key) ?? 0) + row.count);
      } else {
        const normalizedKey = normalizeAutomationToken(label);
        previousCounts.set(normalizedKey, (previousCounts.get(normalizedKey) ?? 0) + row.count);
      }
    }
  }

  const chartData = [
    ...intents.map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      count: counts.get(def.key) ?? 0,
      previousCount: previousCounts.get(def.key) ?? 0,
    })),
    ...[...dynamicLabels].map(([key, label]) => ({
      key,
      label,
      color: FALLBACK_COLOR,
      count: counts.get(key) ?? 0,
      previousCount: previousCounts.get(key) ?? 0,
    })),
  ]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = chartData.reduce((acc, r) => acc + r.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-[var(--ink)]">{title}</CardTitle>
        <span className="text-xs text-[var(--muted-ink)] tabular-nums">
          {formatNumber(total, locale)} {summarySuffix}
        </span>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 44)}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 48, left: 16, bottom: 4 }}
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: "var(--ink)" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              cursor={{ fill: "var(--canvas)" }}
              formatter={(value) => [formatNumber(Number(value), locale), tooltipLabel]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--ink)",
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((row) => (
                <Cell key={row.key} fill={row.color || FALLBACK_COLOR} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                formatter={(v) => formatNumber(Number(v ?? 0), locale)}
                style={{ fontSize: 12, fill: "var(--ink)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {previousData ? (
          <div className="mt-3 flex flex-wrap gap-1.5 px-2">
            {chartData.map((row) => {
              const delta = bucketDelta(row.count, row.previousCount);
              if (!delta) return null;
              const Icon =
                delta.direction === "up" || delta.direction === "new"
                  ? ArrowUpRight
                  : delta.direction === "down"
                    ? ArrowDownRight
                    : Minus;
              const color =
                delta.direction === "flat"
                  ? "text-[var(--muted-ink)]"
                  : delta.direction === "down"
                    ? "text-[var(--bad)]"
                    : "text-[var(--good)]";
              const text =
                delta.direction === "new"
                  ? "Nuevo"
                  : delta.direction === "flat"
                    ? "Sin cambios"
                    : formatSignedPercent(delta.pctChange ?? 0, locale);
              return (
                <span
                  key={row.key}
                  className={`inline-flex items-center gap-1 rounded-md bg-[var(--canvas)] px-1.5 py-0.5 text-[11px] ${color}`}
                  title={`${row.label}: período actual ${row.count} · anterior ${row.previousCount}`}
                >
                  <span className="font-medium text-[var(--ink)]">{row.label}</span>
                  <Icon className="size-3" aria-hidden="true" />
                  <span className="tabular-nums">{text}</span>
                </span>
              );
            })}
          </div>
        ) : null}
        {engagementDensity && engagementDensity.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 px-2">
            {chartData.map((row) => {
              const density = engagementDensity.find((d) => d.intent === row.label);
              if (!density || density.perContact <= 0) return null;
              return (
                <span
                  key={row.key}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--canvas)] px-1.5 py-0.5 text-[11px]"
                  title={`${row.label}: ${formatNumber(row.count, locale)} interacciones / ${formatNumber(Math.round(row.count / density.perContact), locale)} contactos`}
                >
                  <span className="font-medium text-[var(--ink)]">{row.label}</span>
                  <span className="tabular-nums text-[var(--muted-ink)]">
                    {density.perContact.toLocaleString(locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{" "}
                    por contacto
                  </span>
                </span>
              );
            })}
          </div>
        ) : null}
        {handoffRates && handoffRates.length > 0 ? (
          <div className="mt-3 space-y-2 px-2">
            <div className="flex flex-wrap gap-1.5">
              {chartData.map((row) => {
                const rate = handoffRates.find((r) => r.intent === row.label);
                if (!rate) return null;
                const def = intents.find(
                  (i) => i.key.toLowerCase() === row.key.toLowerCase()
                    || i.label.toLowerCase() === row.label.toLowerCase(),
                );
                const tone = chipToneFor(rate.rate, def?.desiredHandoffRate);
                return (
                  <span
                    key={row.key}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${CHIP_CLASSES[tone]}`}
                    title={
                      def?.desiredHandoffRate !== undefined
                        ? `Objetivo: ${formatPercent(def.desiredHandoffRate, locale)}`
                        : "Sin objetivo definido"
                    }
                  >
                    <span className="font-medium">{row.label}</span>
                    <span className="tabular-nums">
                      {formatPercent(rate.rate, locale)} derivación
                    </span>
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-[var(--soft-ink)]">
              Atribución por último contacto: cada contacto aparece en una sola fila. La suma de
              tasas no equivale a la tasa global de derivación: contactos cuya última actividad fue
              navegación del menú quedan fuera de estas filas pero cuentan en la tasa global, y el
              promedio de proporciones por bucket no coincide con el cociente total.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
