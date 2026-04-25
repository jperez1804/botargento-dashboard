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
    <Card className="ring-1 ring-black/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Volumen de mensajes</CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={[...data]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="day"
              tickFormatter={(v) => formatShortDate(String(v), locale)}
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(v) => formatLongDate(String(v), locale)}
              formatter={(v) => formatNumber(Number(v), locale)}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                fontSize: 12,
              }}
              cursor={{ stroke: "#e5e7eb" }}
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
              stroke="#94a3b8"
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
