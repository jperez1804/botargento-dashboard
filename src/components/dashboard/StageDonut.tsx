"use client";

// Leads per stage as a donut (recharts needs the client) with the total in
// the middle and an HTML legend beside it — counts in the legend keep each
// slice identifiable without relying on color alone (7 stages share 5 tones).

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import { STAGE_DOT_CLASS } from "@/components/dashboard/lead-field-class";
import type { CrmStageTone } from "@/config/verticals/_types";

export type DonutSlice = { key: string; label: string; count: number; pct: number; tone: CrmStageTone };

type Props = {
  slices: ReadonlyArray<DonutSlice>;
  total: number;
  totalUnit: string;
  locale: string;
};

const TONE_FILL: Record<CrmStageTone, string> = {
  neutral: "var(--faint-ink)",
  info: "var(--info)",
  progress: "var(--warning)",
  good: "var(--positive)",
  bad: "var(--danger)",
};

export function StageDonut({ slices, total, totalUnit, locale }: Props) {
  // The second stage sharing a tone (reserva after visita) gets a lighter mix
  // so neighbouring slices stay distinguishable.
  const seen = new Map<CrmStageTone, number>();
  const fills = slices.map((s) => {
    const n = seen.get(s.tone) ?? 0;
    seen.set(s.tone, n + 1);
    return n === 0 ? TONE_FILL[s.tone] : `color-mix(in oklch, ${TONE_FILL[s.tone]} 55%, var(--surface))`;
  });
  const data = slices
    .map((s, i) => ({ ...s, fill: fills[i] }))
    .filter((s) => s.count > 0);

  return (
    <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-center">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              cornerRadius={3}
              stroke="var(--surface)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((s) => (
                <Cell key={s.key} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatNumber(Number(value), locale), ""]}
              separator=""
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--rule-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ink)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-semibold leading-none tabular-nums text-[var(--ink)]">
            {formatNumber(total, locale)}
          </span>
          <span className="mt-1 text-[11px] uppercase tracking-[0.08em] text-[var(--soft-ink)]">{totalUnit}</span>
        </div>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {slices.map((s) => (
          <li key={s.key} data-summary-stage={s.key} className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", STAGE_DOT_CLASS[s.tone])} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{s.label}</span>
            <span className="tabular-nums font-medium text-[var(--ink)]">{formatNumber(s.count, locale)}</span>
            <span className="w-11 text-right tabular-nums text-[12px] text-[var(--soft-ink)]">
              {formatPercent(s.pct, locale, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
