"use client";

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
import { formatNumber } from "@/lib/format";
import { formatAutomationLabel, normalizeAutomationToken } from "@/lib/automation-labels";
import type { IntentCount } from "@/lib/queries/intents";
import type { IntentDef } from "@/config/verticals/_types";

const FALLBACK_COLOR = "#94a3b8";

type Props = {
  data: ReadonlyArray<IntentCount>;
  intents: ReadonlyArray<IntentDef>;
  locale: string;
};

export function IntentsChart({ data, intents, locale }: Props) {
  // Fold rows into configured intent buckets, but keep known automation tokens
  // visible with client-friendly labels instead of hiding them under "Otras".
  const byKey = new Map<string, IntentDef>();
  for (const i of intents) byKey.set(i.key.toLowerCase(), i);
  const byLabel = new Map<string, IntentDef>();
  for (const i of intents) byLabel.set(i.label.toLowerCase(), i);
  const knownKeys = new Set(byKey.keys());
  const otras = intents.find((i) => i.key === "Otras");
  const counts = new Map<string, number>();
  for (const def of intents) counts.set(def.key, 0);
  const dynamicLabels = new Map<string, string>();
  for (const row of data) {
    const key = row.intent.toLowerCase();
    if (knownKeys.has(key)) {
      const def = byKey.get(key)!;
      counts.set(def.key, (counts.get(def.key) ?? 0) + row.count);
    } else {
      const formatted = formatAutomationLabel(row.intent);
      if (formatted && formatted !== row.intent.trim()) {
        const labelHit = byLabel.get(formatted.toLowerCase());
        if (labelHit) {
          counts.set(labelHit.key, (counts.get(labelHit.key) ?? 0) + row.count);
        } else {
          const normalizedKey = normalizeAutomationToken(row.intent);
          dynamicLabels.set(normalizedKey, formatted);
          counts.set(normalizedKey, (counts.get(normalizedKey) ?? 0) + row.count);
        }
      } else if (otras) {
        counts.set(otras.key, (counts.get(otras.key) ?? 0) + row.count);
      } else {
        counts.set(row.intent, (counts.get(row.intent) ?? 0) + row.count);
      }
    }
  }
  const chartData = [
    ...intents.map((def) => ({
      key: def.key,
      label: def.label,
      color: def.color,
      count: counts.get(def.key) ?? 0,
    })),
    ...[...dynamicLabels].map(([key, label]) => ({
      key,
      label,
      color: FALLBACK_COLOR,
      count: counts.get(key) ?? 0,
    })),
  ]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const total = chartData.reduce((acc, r) => acc + r.count, 0);

  return (
    <Card className="ring-1 ring-black/5">
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Mensajes por intención</CardTitle>
        <span className="text-xs text-[#6b7280]">
          {formatNumber(total, locale)} mensajes en 7 días
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
              tick={{ fontSize: 12, fill: "#374151" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              cursor={{ fill: "#f3f4f6" }}
              formatter={(value) => [formatNumber(Number(value), locale), "Mensajes"]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
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
                style={{ fontSize: 12, fill: "#374151" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
