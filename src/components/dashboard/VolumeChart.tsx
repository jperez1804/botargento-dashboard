"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
        <CardTitle className="text-[15px] font-semibold text-[var(--ink)]">
          Mensajes entrantes y salientes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={[...data]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            {/* Series 1 (--chart-1 = tenant primary) gets a subtle gradient
              * fill below the line so the leading metric reads as the
              * dominant signal. Series 2 stays line-only to recede. */}
            <defs>
              <linearGradient id="volume-inbound-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 4"
              stroke="var(--rule)"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tickFormatter={(v) => formatShortDate(String(v), locale)}
              tick={{ fontSize: 11.5, fill: "var(--soft-ink)" }}
              axisLine={false}
              tickLine={false}
              minTickGap={8}
            />
            <YAxis
              tick={{ fontSize: 11.5, fill: "var(--soft-ink)" }}
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
                border: "1px solid var(--rule-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--ink)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              }}
              cursor={{ stroke: "var(--rule-strong)", strokeDasharray: "3 3" }}
            />
            <Legend
              iconType="plainline"
              wrapperStyle={{
                fontSize: 12.5,
                paddingTop: 12,
                color: "var(--muted-ink)",
              }}
            />
            <Area
              type="monotone"
              dataKey="inbound"
              name="Entrantes"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#volume-inbound-fill)"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                fill: "var(--surface)",
                stroke: "var(--chart-1)",
              }}
            />
            <Area
              type="monotone"
              dataKey="outbound"
              name="Salientes"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="transparent"
              dot={false}
              activeDot={{
                r: 4,
                strokeWidth: 2,
                fill: "var(--surface)",
                stroke: "var(--chart-2)",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
