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

export type ProviderRow = {
  id: number;
  contact_wa_id: string;
  business_name: string;
  category: string;
  zone: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
  lead_name: string;
  profile_name: string;
  created_at: string;
  updated_at: string;
  last_inbound_at: string | null;
};

export type LaborPoolRow = {
  id: number;
  contact_wa_id: string;
  worker_name: string;
  mode: string;
  specialty: string;
  zone: string;
  phone: string;
  status: string;
  notes: string;
  lead_name: string;
  profile_name: string;
  created_at: string;
  updated_at: string;
  last_inbound_at: string | null;
};

export const REQUIRED_VIEWS = [
  "v_daily_metrics",
  "v_flow_breakdown",
  "v_contact_summary",
  "v_handoff_summary",
  "v_follow_up_queue",
  "v_providers",
  "v_labor_pool",
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

function nullableStr(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

export async function selectProviders(opts: {
  search?: string;
  category?: string;
  zone?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ProviderRow[]> {
  const { search, category, zone, status, limit = 200, offset = 0 } = opts;
  const rows = await pg<Record<string, unknown>[]>`
    SELECT id, contact_wa_id, business_name, category, zone, email, phone,
           status, notes, lead_name, profile_name, created_at, updated_at,
           last_inbound_at
    FROM automation.v_providers
    WHERE 1=1
      ${category ? pg`AND category = ${category}` : pg``}
      ${zone ? pg`AND zone ILIKE ${"%" + zone + "%"}` : pg``}
      ${status ? pg`AND status = ${status}` : pg``}
      ${
        search
          ? pg`AND (business_name ILIKE ${"%" + search + "%"}
                OR lead_name ILIKE ${"%" + search + "%"}
                OR profile_name ILIKE ${"%" + search + "%"}
                OR email ILIKE ${"%" + search + "%"})`
          : pg``
      }
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => ({
    id: toNum(r.id),
    contact_wa_id: String(r.contact_wa_id ?? ""),
    business_name: String(r.business_name ?? ""),
    category: String(r.category ?? ""),
    zone: String(r.zone ?? ""),
    email: String(r.email ?? ""),
    phone: String(r.phone ?? ""),
    status: String(r.status ?? ""),
    notes: String(r.notes ?? ""),
    lead_name: String(r.lead_name ?? ""),
    profile_name: String(r.profile_name ?? ""),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    last_inbound_at: nullableStr(r.last_inbound_at),
  }));
}

export async function countProviders(opts: {
  search?: string;
  category?: string;
  zone?: string;
  status?: string;
} = {}): Promise<number> {
  const { search, category, zone, status } = opts;
  const rows = await pg<{ count: string | number }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM automation.v_providers
    WHERE 1=1
      ${category ? pg`AND category = ${category}` : pg``}
      ${zone ? pg`AND zone ILIKE ${"%" + zone + "%"}` : pg``}
      ${status ? pg`AND status = ${status}` : pg``}
      ${
        search
          ? pg`AND (business_name ILIKE ${"%" + search + "%"}
                OR lead_name ILIKE ${"%" + search + "%"}
                OR profile_name ILIKE ${"%" + search + "%"}
                OR email ILIKE ${"%" + search + "%"})`
          : pg``
      }
  `;
  return toNum(rows[0]?.count);
}

export async function listProviderCategories(): Promise<string[]> {
  const rows = await pg<{ category: string }[]>`
    SELECT DISTINCT category FROM automation.providers
    WHERE category <> ''
    ORDER BY category ASC
  `;
  return rows.map((r) => String(r.category));
}

export async function selectLaborPool(opts: {
  search?: string;
  specialty?: string;
  zone?: string;
  mode?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<LaborPoolRow[]> {
  const {
    search,
    specialty,
    zone,
    mode,
    status,
    limit = 200,
    offset = 0,
  } = opts;
  const rows = await pg<Record<string, unknown>[]>`
    SELECT id, contact_wa_id, worker_name, mode, specialty, zone, phone,
           status, notes, lead_name, profile_name, created_at, updated_at,
           last_inbound_at
    FROM automation.v_labor_pool
    WHERE 1=1
      ${specialty ? pg`AND specialty = ${specialty}` : pg``}
      ${zone ? pg`AND zone ILIKE ${"%" + zone + "%"}` : pg``}
      ${mode ? pg`AND mode = ${mode}` : pg``}
      ${status ? pg`AND status = ${status}` : pg``}
      ${
        search
          ? pg`AND (worker_name ILIKE ${"%" + search + "%"}
                OR lead_name ILIKE ${"%" + search + "%"}
                OR profile_name ILIKE ${"%" + search + "%"})`
          : pg``
      }
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => ({
    id: toNum(r.id),
    contact_wa_id: String(r.contact_wa_id ?? ""),
    worker_name: String(r.worker_name ?? ""),
    mode: String(r.mode ?? ""),
    specialty: String(r.specialty ?? ""),
    zone: String(r.zone ?? ""),
    phone: String(r.phone ?? ""),
    status: String(r.status ?? ""),
    notes: String(r.notes ?? ""),
    lead_name: String(r.lead_name ?? ""),
    profile_name: String(r.profile_name ?? ""),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    last_inbound_at: nullableStr(r.last_inbound_at),
  }));
}

export async function countLaborPool(opts: {
  search?: string;
  specialty?: string;
  zone?: string;
  mode?: string;
  status?: string;
} = {}): Promise<number> {
  const { search, specialty, zone, mode, status } = opts;
  const rows = await pg<{ count: string | number }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM automation.v_labor_pool
    WHERE 1=1
      ${specialty ? pg`AND specialty = ${specialty}` : pg``}
      ${zone ? pg`AND zone ILIKE ${"%" + zone + "%"}` : pg``}
      ${mode ? pg`AND mode = ${mode}` : pg``}
      ${status ? pg`AND status = ${status}` : pg``}
      ${
        search
          ? pg`AND (worker_name ILIKE ${"%" + search + "%"}
                OR lead_name ILIKE ${"%" + search + "%"}
                OR profile_name ILIKE ${"%" + search + "%"})`
          : pg``
      }
  `;
  return toNum(rows[0]?.count);
}

export async function listLaborSpecialties(): Promise<string[]> {
  const rows = await pg<{ specialty: string }[]>`
    SELECT DISTINCT specialty FROM automation.labor_pool
    WHERE specialty <> ''
    ORDER BY specialty ASC
  `;
  return rows.map((r) => String(r.specialty));
}

// ---------------------------------------------------------------------------
// Outbound campaigns (outreach.v_*) — read-only, feature-gated behind
// features.campaignsTab. Only tenants with the outreach.* schema have these
// views; the campaigns page is the sole caller, so other tenants never hit them.
// ---------------------------------------------------------------------------

export type CampaignStatsRow = {
  campaign_id: number;
  name: string;
  vertical: string;
  template_name: string;
  status: string;
  daily_cap: number;
  total_recipients: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  opted_out: number;
  sent_today: number;
  reply_rate: number;
  opt_out_rate: number;
  last_send_at: string | null;
};

export type OutreachOverview = {
  total_recipients: number;
  total_sent: number;
  total_replied: number;
  total_opted_out: number;
  sent_today: number;
  reply_rate: number;
  suppressed: number;
};

export type CampaignDailyRow = {
  day: string;
  campaign_id: number;
  sent_count: number;
};

export type QualityCurrent = {
  quality_rating: string | null;
  messaging_limit_tier: string | null;
  last_event: string | null;
  last_updated: string | null;
};

export async function selectCampaignStats(): Promise<CampaignStatsRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT campaign_id, name, vertical, template_name, status, daily_cap,
           total_recipients, pending, sent, delivered, read, replied, failed,
           opted_out, sent_today, reply_rate, opt_out_rate, last_send_at
    FROM outreach.v_campaign_stats
  `;
  return rows.map((r) => ({
    campaign_id: toNum(r.campaign_id),
    name: String(r.name ?? ""),
    vertical: String(r.vertical ?? ""),
    template_name: String(r.template_name ?? ""),
    status: String(r.status ?? ""),
    daily_cap: toNum(r.daily_cap),
    total_recipients: toNum(r.total_recipients),
    pending: toNum(r.pending),
    sent: toNum(r.sent),
    delivered: toNum(r.delivered),
    read: toNum(r.read),
    replied: toNum(r.replied),
    failed: toNum(r.failed),
    opted_out: toNum(r.opted_out),
    sent_today: toNum(r.sent_today),
    reply_rate: Number(r.reply_rate ?? 0),
    opt_out_rate: Number(r.opt_out_rate ?? 0),
    last_send_at: nullableStr(r.last_send_at),
  }));
}

export async function getOutreachOverview(): Promise<OutreachOverview> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT total_recipients, total_sent, total_replied, total_opted_out,
           sent_today, reply_rate, suppressed
    FROM outreach.v_outreach_overview
  `;
  const r = rows[0] ?? {};
  return {
    total_recipients: toNum(r.total_recipients),
    total_sent: toNum(r.total_sent),
    total_replied: toNum(r.total_replied),
    total_opted_out: toNum(r.total_opted_out),
    sent_today: toNum(r.sent_today),
    reply_rate: Number(r.reply_rate ?? 0),
    suppressed: toNum(r.suppressed),
  };
}

export async function selectCampaignDaily(days: number): Promise<CampaignDailyRow[]> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT send_date AS day, campaign_id, sent_count
    FROM outreach.v_campaign_daily
    WHERE send_date >= CURRENT_DATE - ${days}::int
    ORDER BY day ASC
  `;
  return rows.map((r) => ({
    day: String(r.day),
    campaign_id: toNum(r.campaign_id),
    sent_count: toNum(r.sent_count),
  }));
}

export async function getQualityCurrent(): Promise<QualityCurrent> {
  const rows = await pg<Record<string, unknown>[]>`
    SELECT quality_rating, messaging_limit_tier, last_event, last_updated
    FROM outreach.v_quality_current
  `;
  const r = rows[0] ?? {};
  return {
    quality_rating: nullableStr(r.quality_rating),
    messaging_limit_tier: nullableStr(r.messaging_limit_tier),
    last_event: nullableStr(r.last_event),
    last_updated: nullableStr(r.last_updated),
  };
}
