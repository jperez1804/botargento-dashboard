// All SQL lives under src/lib/queries/*.ts per Reglas #2. Pages + components
// must import from here, never inline queries.

import { sql } from "@/db/client";

export type DailyMetricPoint = {
  day: string; // ISO date in tenant tz, as emitted by v_daily_metrics.
  inbound: number;
  outbound: number;
  handoff: number;
  handoffRate: number; // 0..1, pre-calculated in the view.
};

export type WindowKpis = {
  inbound: number;
  outbound: number;
  unique_contacts: number;
  handoff_total: number;
  handoff_rate: number; // 0..1
};

/**
 * Daily rows from v_daily_metrics for the last `days` days, including today,
 * oldest first. For days=7, this returns today plus the previous six dates.
 */
export async function getDailyMetrics(days: number): Promise<DailyMetricPoint[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      report_date AS day,
      inbound_messages AS inbound_count,
      outbound_messages AS outbound_count,
      contacts_with_handoff AS handoff_count,
      handoff_rate
    FROM automation.v_daily_metrics
    WHERE report_date >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - (${days}::int - 1)
    ORDER BY day ASC
  `;
  return rows.map((r) => ({
    day: String(r.day),
    inbound: Number(r.inbound_count ?? 0),
    outbound: Number(r.outbound_count ?? 0),
    handoff: Number(r.handoff_count ?? 0),
    handoffRate: Number(r.handoff_rate ?? 0),
  }));
}

/**
 * KPI aggregates over inclusive date bounds:
 * `[today - startDaysAgo, today - endDaysAgo]`.
 *
 * Examples:
 *   - last 7 days including today: getWindowKpis(6, 0)
 *   - prior 7 days: getWindowKpis(13, 7)
 *
 * inbound / outbound / handoff_total sum the view rows. unique_contacts runs
 * its own DISTINCT query against lead_log because summing daily uniques
 * double-counts returning contacts.
 */
export async function getWindowKpis(
  startDaysAgo: number,
  endDaysAgo: number,
): Promise<WindowKpis> {
  const aggRows = await sql<Record<string, unknown>[]>`
    SELECT
      COALESCE(SUM(inbound_messages),      0)::int AS inbound,
      COALESCE(SUM(outbound_messages),     0)::int AS outbound,
      COALESCE(SUM(contacts_with_handoff), 0)::int AS handoff_total
    FROM automation.v_daily_metrics
    WHERE report_date >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${startDaysAgo}::int
      AND report_date <= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${endDaysAgo}::int
  `;
  const uniqRows = await sql<Record<string, unknown>[]>`
    SELECT COALESCE(COUNT(DISTINCT contact_wa_id), 0)::int AS n
    FROM automation.lead_log
    WHERE direction = 'inbound'
      AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') >= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${startDaysAgo}::int
      AND DATE(log_timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') <= DATE(NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires') - ${endDaysAgo}::int
  `;

  const agg = aggRows[0];
  const uniq = uniqRows[0];
  const inbound = Number(agg?.inbound ?? 0);
  const outbound = Number(agg?.outbound ?? 0);
  const handoff_total = Number(agg?.handoff_total ?? 0);
  const unique_contacts = Number(uniq?.n ?? 0);

  return {
    inbound,
    outbound,
    unique_contacts,
    handoff_total,
    handoff_rate: inbound > 0 ? handoff_total / inbound : 0,
  };
}
