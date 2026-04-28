// Typed wrappers around the read-only `automation.v_*` reporting surface.
// Drizzle does not model views as first-class entities, so we use postgres.js
// directly and coerce the result rows at the boundary.

import { sql as pg } from "@/db/client";

export type DailyMetricsRow = {
  day: string;
  inbound_count: number;
  outbound_count: number;
  unique_contacts: number;
  handoff_count: number;
  handoff_rate: number;
};

export type FlowBreakdownRow = {
  day: string;
  intent: string | null;
  route: string | null;
  inbound_count: number;
};

export type ContactSummaryRow = {
  contact_wa_id: string;
  display_name: string | null;
  first_seen: string;
  last_seen: string;
  message_count: number;
  last_intent: string | null;
  handoff_count: number;
};

export type HandoffSummaryRow = {
  target: string;
  count_all_time: number;
  count_24h: number;
};

export type FollowUpQueueRow = {
  contact_wa_id: string;
  display_name: string | null;
  priority: "high" | "medium" | "low";
  reason: string | null;
  last_seen: string;
};

export const REQUIRED_VIEWS = [
  "v_daily_metrics",
  "v_flow_breakdown",
  "v_contact_summary",
  "v_handoff_summary",
  "v_follow_up_queue",
] as const;

function toNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

export async function selectDailyMetrics(days: number): Promise<DailyMetricsRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT
      report_date AS day,
      inbound_messages AS inbound_count,
      outbound_messages AS outbound_count,
      unique_contacts,
      contacts_with_handoff AS handoff_count,
      handoff_rate
    FROM automation.v_daily_metrics
    WHERE report_date >= CURRENT_DATE - ${days}::int
    ORDER BY day ASC
  `;
  return rows.map((r) => ({
    day: String(r.day),
    inbound_count: toNum(r.inbound_count),
    outbound_count: toNum(r.outbound_count),
    unique_contacts: toNum(r.unique_contacts),
    handoff_count: toNum(r.handoff_count),
    handoff_rate: Number(r.handoff_rate ?? 0),
  }));
}

export async function selectFlowBreakdown(days: number): Promise<FlowBreakdownRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT report_date AS day, intent, route, inbound_count
    FROM automation.v_flow_breakdown
    WHERE report_date >= CURRENT_DATE - ${days}::int
    ORDER BY day ASC, intent ASC
  `;
  return rows.map((r) => ({
    day: String(r.day),
    intent: r.intent === null ? null : String(r.intent),
    route: r.route === null ? null : String(r.route),
    inbound_count: toNum(r.inbound_count),
  }));
}

export async function selectContactSummary(opts: {
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<ContactSummaryRow[]> {
  const { search, from, to, limit = 25, offset = 0 } = opts;
  const rows = await pg<Record<string, unknown>[]>`
    SELECT contact_wa_id, display_name, first_seen, last_seen,
           total_messages AS message_count, last_intent, handoff_count
    FROM automation.v_contact_summary
    WHERE 1=1
      ${from ? pg`AND last_seen >= ${from}::timestamptz` : pg``}
      ${to ? pg`AND last_seen <= ${to}::timestamptz` : pg``}
      ${
        search
          ? pg`AND (display_name ILIKE ${"%" + search + "%"}
                OR contact_wa_id ILIKE ${"%" + search + "%"})`
          : pg``
      }
    ORDER BY last_seen DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => ({
    contact_wa_id: String(r.contact_wa_id),
    display_name: r.display_name === null ? null : String(r.display_name),
    first_seen: String(r.first_seen),
    last_seen: String(r.last_seen),
    message_count: toNum(r.message_count),
    last_intent: r.last_intent === null ? null : String(r.last_intent),
    handoff_count: toNum(r.handoff_count),
  }));
}

export async function selectHandoffSummary(): Promise<HandoffSummaryRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT
      handoff_target AS target,
      total_count AS count_all_time,
      last_24h_count AS count_24h
    FROM automation.v_handoff_summary
    ORDER BY count_24h DESC, count_all_time DESC
  `;
  return rows.map((r) => ({
    target: String(r.target),
    count_all_time: toNum(r.count_all_time),
    count_24h: toNum(r.count_24h),
  }));
}

export async function selectFollowUpQueue(limit?: number): Promise<FollowUpQueueRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    WITH contact_activity AS (
      SELECT
        contact_wa_id,
        COALESCE(NULLIF(MAX(lead_name), ''), NULLIF(MAX(profile_name), ''), contact_wa_id) AS display_name,
        MAX(log_timestamp) AS last_seen,
        MAX(intent) FILTER (
          WHERE direction = 'inbound'
            AND log_timestamp = (
              SELECT MAX(l2.log_timestamp)
              FROM automation.lead_log l2
              WHERE l2.contact_wa_id = lead_log.contact_wa_id
                AND l2.direction = 'inbound'
            )
        ) AS last_intent,
        MAX(route) FILTER (
          WHERE log_timestamp = (
            SELECT MAX(l3.log_timestamp)
            FROM automation.lead_log l3
            WHERE l3.contact_wa_id = lead_log.contact_wa_id
          )
        ) AS last_route,
        COUNT(*) FILTER (
          WHERE direction = 'inbound'
            AND log_timestamp >= NOW() - INTERVAL '7 days'
        ) AS inbound_last_7d
      FROM automation.lead_log
      WHERE log_timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY contact_wa_id
    ),
    latest_handoff AS (
      SELECT DISTINCT ON (contact_wa_id)
        contact_wa_id,
        escalation_timestamp,
        handoff_target,
        reason
      FROM automation.escalations
      ORDER BY contact_wa_id, escalation_timestamp DESC
    )
    SELECT
      ca.contact_wa_id,
      ca.display_name,
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours' THEN 'high'
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL THEN 'medium'
        ELSE 'low'
      END AS priority,
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours'
          THEN COALESCE(NULLIF(lh.reason, ''), NULLIF(lh.handoff_target, ''), 'Derivacion reciente')
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL
          THEN COALESCE(NULLIF(ca.last_intent, ''), NULLIF(ca.last_route, ''), 'Alta actividad reciente')
        ELSE COALESCE(NULLIF(ca.last_intent, ''), NULLIF(ca.last_route, ''), 'Seguimiento sugerido')
      END AS reason,
      ca.last_seen
    FROM contact_activity ca
    LEFT JOIN latest_handoff lh ON lh.contact_wa_id = ca.contact_wa_id
    ORDER BY
      CASE
        WHEN lh.escalation_timestamp >= NOW() - INTERVAL '48 hours' THEN 0
        WHEN ca.inbound_last_7d >= 3 AND lh.contact_wa_id IS NULL THEN 1
        ELSE 2
      END,
      ca.last_seen DESC
    ${limit ? pg`LIMIT ${limit}` : pg``}
  `;

  return rows.map((r) => {
    const p = String(r.priority);
    const priority: FollowUpQueueRow["priority"] =
      p === "high" || p === "medium" || p === "low" ? p : "low";
    return {
      contact_wa_id: String(r.contact_wa_id),
      display_name: r.display_name === null ? null : String(r.display_name),
      priority,
      reason: r.reason === null ? null : String(r.reason),
      last_seen: String(r.last_seen),
    };
  });
}
