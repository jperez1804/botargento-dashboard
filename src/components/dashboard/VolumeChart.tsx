"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate, formatShortDate } from "@/lib/date";
import { formatNumber } from "@/lib/format";
import type { DailyMetricPoint } from "@/lib/queries/metrics";

type Props = {
  data: ReadonlyArray<DailyMetricPoint>;
  locale: string;
};

export function VolumeChart({ data, locale }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[var(--ink)]">
          Volumen de mensajes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={[...data]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
            <XAxis
              dataKey="day"
              tickFormatter={(v) => formatShortDate(String(v), locale)}
              tick={{ fontSize: 12, fill: "var(--muted-ink)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted-ink)" }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(v) => formatLongDate(String(v), locale)}
              formatter={(v) => formatNumber(Number(v), locale)}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--ink)",
              }}
              cursor={{ stroke: "var(--rule)" }}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="inbound"
              name="Entrantes"
              stroke="var(--client-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="outbound"
              name="Salientes"
              stroke="var(--soft-ink)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
