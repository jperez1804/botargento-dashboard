// Read side of the CRM-lite. One query gathers every signal per contact —
// messages (automation.lead_log), real handoffs (automation.escalations),
// opt-outs (outreach.suppression, when the tenant has it), and the dashboard's
// own lead_state / lead_events — and deriveLead() turns them into a stage.
//
// Deliberately NOT built on v_contact_summary (4 correlated subqueries per
// contact): a single GROUP BY over lead_log rides ix_lead_log_contact_timestamp.
// Derivation, filtering and pagination happen in memory, which is trivial at
// real-estate volumes (client1: a handful of contacts per month). If a tenant
// ever passes ~10k contacts, port deriveLead() to a SQL CTE and keep
// tests/unit/crm-effective-stage.test.ts as the equivalence fixture.

import { sql } from "@/db/client";
import type { CrmConfig } from "@/config/verticals/_types";
import {
  ACTIVITY_EVENT_KINDS,
  deriveLead,
  type EffectiveLead,
  type LeadSignals,
  type LeadStateRow,
} from "@/lib/crm/effective-stage";
import { hasLeadLogSentBy, hasOutreachSuppression } from "@/lib/crm/probes";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";

export type LeadRow = {
  contactWaId: string;
  displayName: string;
  firstSeen: Date | null;
  lastMessageAt: Date | null;
  handoffCount: number;
  lead: EffectiveLead;
};

const toDate = (v: unknown): Date | null =>
  v === null || v === undefined ? null : new Date(v as string | Date);

async function selectLeadRows(
  config: CrmConfig,
  now: Date,
  waIds?: ReadonlyArray<string>,
): Promise<LeadRow[]> {
  const [sentBy, suppression] = await Promise.all([
    hasLeadLogSentBy(),
    hasOutreachSuppression(),
  ]);
  const onlyIds = waIds && waIds.length > 0 ? [...waIds] : null;

  const rows = await sql<Record<string, unknown>[]>`
    WITH msgs AS (
      SELECT
        contact_wa_id,
        COALESCE(NULLIF(MAX(lead_name), ''), NULLIF(MAX(profile_name), ''), contact_wa_id) AS display_name,
        MIN(log_timestamp) AS first_seen,
        MAX(log_timestamp) AS last_message_at,
        ${sentBy
          ? sql`MAX(log_timestamp) FILTER (WHERE sent_by = 'human')`
          : sql`NULL::timestamptz`} AS last_human_log_at
      FROM automation.lead_log
      WHERE contact_wa_id <> ''
        ${onlyIds ? sql`AND contact_wa_id IN ${sql(onlyIds)}` : sql``}
      GROUP BY contact_wa_id
    ),
    handoffs AS (
      SELECT contact_wa_id,
             MAX(escalation_timestamp) AS last_handoff_at,
             COUNT(*)::int AS handoff_count
      FROM automation.escalations
      WHERE escalation_type NOT IN ${sql(NON_BUSINESS_ESCALATION_TYPES)}
        AND contact_wa_id IN (SELECT contact_wa_id FROM msgs)
      GROUP BY contact_wa_id
    ),
    events AS (
      SELECT contact_wa_id,
             MAX(occurred_at) FILTER (WHERE kind IN ${sql([...ACTIVITY_EVENT_KINDS])}) AS last_crm_activity_at,
             MAX(occurred_at) FILTER (WHERE kind = 'contact') AS last_contact_event_at
      FROM dashboard.lead_events
      WHERE contact_wa_id IN (SELECT contact_wa_id FROM msgs)
      GROUP BY contact_wa_id
    )
    SELECT
      m.contact_wa_id, m.display_name, m.first_seen, m.last_message_at, m.last_human_log_at,
      h.last_handoff_at, COALESCE(h.handoff_count, 0) AS handoff_count,
      e.last_crm_activity_at, e.last_contact_event_at,
      s.contact_wa_id AS state_wa_id,
      s.stage, s.stage_changed_at, s.lost_reason, s.owner_email,
      s.next_action_at, s.next_action_note, s.next_action_done_at,
      ${suppression
        ? sql`(SELECT MIN(o.created_at) FROM outreach.suppression o WHERE o.wa_id = m.contact_wa_id)`
        : sql`NULL::timestamptz`} AS opted_out_at
    FROM msgs m
    LEFT JOIN handoffs h ON h.contact_wa_id = m.contact_wa_id
    LEFT JOIN events e ON e.contact_wa_id = m.contact_wa_id
    LEFT JOIN dashboard.lead_state s ON s.contact_wa_id = m.contact_wa_id
  `;

  return rows.map((r) => {
    const signals: LeadSignals = {
      firstSeen: toDate(r.first_seen),
      lastMessageAt: toDate(r.last_message_at),
      lastHandoffAt: toDate(r.last_handoff_at),
      lastHumanContactAt: [toDate(r.last_human_log_at), toDate(r.last_contact_event_at)]
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      optedOutAt: toDate(r.opted_out_at),
      lastCrmActivityAt: toDate(r.last_crm_activity_at),
    };
    const state: LeadStateRow | null = r.state_wa_id !== null
      ? {
          stage: r.stage === null ? null : String(r.stage),
          stageChangedAt: toDate(r.stage_changed_at),
          lostReason: String(r.lost_reason ?? ""),
          ownerEmail: r.owner_email === null ? null : String(r.owner_email),
          nextActionAt: toDate(r.next_action_at),
          nextActionNote: String(r.next_action_note ?? ""),
          nextActionDoneAt: toDate(r.next_action_done_at),
        }
      : null;
    return {
      contactWaId: String(r.contact_wa_id),
      displayName: String(r.display_name),
      firstSeen: signals.firstSeen,
      lastMessageAt: signals.lastMessageAt,
      handoffCount: Number(r.handoff_count ?? 0),
      lead: deriveLead(signals, state, config, now),
    };
  });
}

export type LeadListFilter = "at_risk" | "overdue" | "unassigned";

export const LEAD_LIST_FILTERS: ReadonlyArray<LeadListFilter> = [
  "at_risk",
  "overdue",
  "unassigned",
];

export type ListLeadsParams = {
  stage?: string;
  owner?: string; // email; "none" = unassigned
  filter?: LeadListFilter;
  q?: string;
  // Lost leads pile up (every idle contact ends there), so they are hidden
  // unless the stage filter asks for them explicitly.
  includeLost?: boolean;
};

export type ListLeadsResult = {
  rows: LeadRow[];
  // Per-stage counts over the unfiltered-by-stage set, for the stage chips
  // and the board column headers.
  stageCounts: Record<string, number>;
};

function matchesQuery(row: LeadRow, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return row.displayName.toLowerCase().includes(term) || row.contactWaId.includes(term);
}

export async function listLeads(
  config: CrmConfig,
  params: ListLeadsParams,
  now: Date,
): Promise<ListLeadsResult> {
  const all = await selectLeadRows(config, now);
  const lostKey = config.autoStages.lost;

  const base = all.filter((row) => {
    if (params.owner === "none" && row.lead.owner !== null) return false;
    if (params.owner && params.owner !== "none" && row.lead.owner !== params.owner) return false;
    if (params.filter === "at_risk" && !row.lead.atRisk) return false;
    if (params.filter === "overdue" && row.lead.reminder?.status !== "overdue") return false;
    if (params.filter === "unassigned" && row.lead.owner !== null) return false;
    if (params.q && !matchesQuery(row, params.q)) return false;
    return true;
  });

  const stageCounts: Record<string, number> = {};
  for (const s of config.stages) stageCounts[s.key] = 0;
  for (const row of base) stageCounts[row.lead.stage] = (stageCounts[row.lead.stage] ?? 0) + 1;

  const rows = base
    .filter((row) => {
      if (params.stage) return row.lead.stage === params.stage;
      return params.includeLost === true || row.lead.stage !== lostKey;
    })
    .sort(
      (a, b) =>
        (b.lead.lastActivityAt?.getTime() ?? 0) - (a.lead.lastActivityAt?.getTime() ?? 0),
    );

  return { rows, stageCounts };
}

export async function getLead(
  config: CrmConfig,
  waId: string,
  now: Date,
): Promise<LeadRow | null> {
  const rows = await selectLeadRows(config, now, [waId]);
  return rows[0] ?? null;
}

export type CrmAlerts = { atRisk: number; overdueReminders: number };

// The banner runs on every navigation; memoize per scope for a minute and drop
// the cache on any CRM write in this process (invalidateCrmAlerts).
const ALERTS_TTL_MS = 60_000;
const alertsCache = new Map<string, { value: CrmAlerts; at: number }>();

export function invalidateCrmAlerts(): void {
  alertsCache.clear();
}

/**
 * Counts for the "leads por vencer / recordatorios vencidos" banner. Scope:
 * pass an owner email to count only that person's leads (asesor), or null to
 * count every lead (admin).
 */
export async function getCrmAlerts(
  config: CrmConfig,
  ownerEmail: string | null,
  now: Date,
): Promise<CrmAlerts> {
  const key = ownerEmail ?? "*";
  const hit = alertsCache.get(key);
  if (hit && now.getTime() - hit.at < ALERTS_TTL_MS) return hit.value;

  const all = await selectLeadRows(config, now);
  const scoped = ownerEmail ? all.filter((r) => r.lead.owner === ownerEmail) : all;
  const value: CrmAlerts = {
    atRisk: scoped.filter((r) => r.lead.atRisk !== null).length,
    overdueReminders: scoped.filter((r) => r.lead.reminder?.status === "overdue").length,
  };
  alertsCache.set(key, { value, at: now.getTime() });
  return value;
}
