"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLongDate, formatShortDate } from "@/lib/date";
import { formatNumber } from "@/lib/format";

type Point = { day: string; sent: number };

type Props = {
  data: ReadonlyArray<Point>;
  locale: string;
};

export function CampaignsDailyChart({ data, locale }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-semibold text-[var(--ink)]">
          Envíos por día
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={[...data]} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="campaigns-sent-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--rule)" vertical={false} />
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
              formatter={(v) => [formatNumber(Number(v), locale), "Envíos"]}
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
            <Area
              type="monotone"
              dataKey="sent"
              name="Envíos"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#campaigns-sent-fill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: "var(--surface)", stroke: "var(--chart-1)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
