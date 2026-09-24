// Read side of the CRM-lite. A lead is an OPPORTUNITY — one commercial
// process — and a person can have several over time (a rental, later a sale,
// an appraisal). One query gathers every signal per opportunity, windowed to
// its own life [opened_at, closed_at), and deriveLead() turns them into a
// stage.
//
// Attribution (the rule that makes several opportunities per person work):
//   - a handoff counts only for the opportunity of ITS rubro;
//   - messages and human replies count for every open opportunity of the
//     person, because nothing in the data says which one they were about;
//   - events carry an opportunity_id, so what an advisor logged is exact.
//
// Deliberately NOT built on v_contact_summary (4 correlated subqueries per
// contact): a single GROUP BY over lead_log rides ix_lead_log_contact_timestamp.
// Derivation, filtering and pagination happen in memory, which is trivial at
// real-estate volumes. If a tenant ever passes ~10k contacts, port deriveLead()
// to a SQL CTE and keep tests/unit/crm-effective-stage.test.ts as the
// equivalence fixture.

import { sql } from "@/db/client";
import type { CrmConfig, CrmPriorityKey } from "@/config/verticals/_types";
import {
  ACTIVITY_EVENT_KINDS,
  deriveLead,
  type EffectiveLead,
  type LeadSignals,
  type LeadStateRow,
} from "@/lib/crm/effective-stage";
import { hasLeadLogSentBy, hasOutreachSuppression, hasSessionMemory } from "@/lib/crm/probes";
import { toBudget, type LeadBudget } from "@/lib/crm/budget";
import { priorityRank } from "@/lib/crm/priority";
import { attentionKind, attentionRank } from "@/lib/crm/attention";
import { tenantConfig } from "@/config/tenant";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";
import { getIntentMap, syncOpportunities } from "@/lib/queries/opportunity-sync";

// Budget logic is pure and lives in lib/crm/budget; re-exported because the
// whole CRM imports it from here.
export { toBudget };
export type { LeadBudget };

/** The person behind the opportunity (dashboard.contacts). */
export type ContactInfo = {
  // 'whatsapp' for people who wrote to the bot, else a manualLeadSources key.
  source: string;
  createdBy: string;
  createdAt: Date;
  firstSeenAt: Date | null;
};

export type OpportunityRow = {
  id: number;
  contactWaId: string;
  // 1, 2, 3… in the order the person's opportunities opened.
  seq: number;
  // How many the person has in total, for the "2 de 3" chip.
  ofTotal: number;
  // Vertical intent key ("Ventas"); '' when nobody has labelled it yet.
  kind: string;
  title: string;
  openedAt: Date;
  // '' = opened automatically by a handoff.
  openedBy: string;
  closedAt: Date | null;
  displayName: string;
  firstSeen: Date | null;
  lastMessageAt: Date | null;
  handoffCount: number;
  budget: LeadBudget | null;
  contact: ContactInfo;
  // Rubro of a recent enquiry nobody is working (rule 7): the card offers to
  // open an opportunity for it. Null when there is nothing new.
  newIntent: string | null;
  lead: EffectiveLead;
};

/** Kept while the UI finishes moving to opportunities. */
export type LeadRow = OpportunityRow;

const toDate = (v: unknown): Date | null =>
  v === null || v === undefined ? null : new Date(v as string | Date);

type Scope = { waIds?: ReadonlyArray<string>; ids?: ReadonlyArray<number> };

async function selectOpportunityRows(
  config: CrmConfig,
  now: Date,
  scope: Scope = {},
): Promise<OpportunityRow[]> {
  const [sentBy, suppression, snapshot, map] = await Promise.all([
    hasLeadLogSentBy(),
    hasOutreachSuppression(),
    hasSessionMemory(),
    getIntentMap(now),
  ]);
  const waIds = scope.waIds && scope.waIds.length > 0 ? [...scope.waIds] : null;
  const ids = scope.ids && scope.ids.length > 0 ? [...scope.ids] : null;

  // A handoff belongs to the opportunity of its rubro (or to one that has no
  // rubro yet). The raw token → rubro map comes from TypeScript.
  const handoffOfOpportunity = sql`
    e.contact_wa_id = o.contact_wa_id
    AND e.escalation_type <> ALL(${[...NON_BUSINESS_ESCALATION_TYPES]}::text[])
    AND e.escalation_timestamp >= o.opened_at
    AND (o.closed_at IS NULL OR e.escalation_timestamp < o.closed_at)
    AND (
      o.kind = ''
      OR o.kind = COALESCE(
        (SELECT m.kind FROM intent_map m WHERE m.raw = to_jsonb(e) ->> 'intent'),
        (SELECT m.kind FROM intent_map m WHERE m.raw = e.escalation_type)
      )
    )
  `;

  const rows = await sql<Record<string, unknown>[]>`
    WITH intent_map AS (
      SELECT * FROM unnest(${map.raws}::text[], ${map.kinds}::text[]) AS t(raw, kind)
    ),
    opps AS (
      SELECT * FROM dashboard.opportunities o
      WHERE true
        ${waIds ? sql`AND o.contact_wa_id IN ${sql(waIds)}` : sql``}
        ${ids ? sql`AND o.id IN ${sql(ids)}` : sql``}
    ),
    persons AS (SELECT DISTINCT contact_wa_id FROM opps),
    names AS (
      -- The name a person typed wins over the WhatsApp profile name.
      SELECT c.contact_wa_id,
             COALESCE(
               NULLIF(c.display_name, ''),
               NULLIF(MAX(l.lead_name), ''),
               NULLIF(MAX(l.profile_name), ''),
               c.contact_wa_id
             ) AS display_name,
             c.source, c.created_by, c.created_at, c.first_seen_at
      FROM dashboard.contacts c
      JOIN persons p ON p.contact_wa_id = c.contact_wa_id
      LEFT JOIN automation.lead_log l ON l.contact_wa_id = c.contact_wa_id
      GROUP BY c.contact_wa_id, c.display_name, c.source, c.created_by, c.created_at, c.first_seen_at
    ),
    msgs AS (
      -- Messages keep every open opportunity of the person alive: nothing in
      -- the data says which one they were about.
      SELECT o.id,
             MIN(l.log_timestamp) AS first_seen,
             MAX(l.log_timestamp) AS last_message_at,
             ${sentBy
               ? sql`MAX(l.log_timestamp) FILTER (WHERE l.sent_by = 'human')`
               : sql`NULL::timestamptz`} AS last_human_log_at
      FROM opps o
      JOIN automation.lead_log l
        ON l.contact_wa_id = o.contact_wa_id
       AND l.log_timestamp >= o.opened_at
       AND (o.closed_at IS NULL OR l.log_timestamp < o.closed_at)
      GROUP BY o.id
    ),
    handoffs AS (
      SELECT o.id,
             MAX(e.escalation_timestamp) AS last_handoff_at,
             COUNT(*)::int AS handoff_count
      FROM opps o
      JOIN automation.escalations e ON ${handoffOfOpportunity}
      GROUP BY o.id
    ),
    budgets AS (
      -- Latest handoff of this opportunity that carried an amount. Read
      -- through to_jsonb: not every tenant has the budget columns.
      SELECT DISTINCT ON (o.id)
             o.id,
             to_jsonb(e) ->> 'budget_amount' AS budget_amount,
             to_jsonb(e) ->> 'budget_currency' AS budget_currency
      FROM opps o
      JOIN automation.escalations e ON ${handoffOfOpportunity}
      WHERE NULLIF(to_jsonb(e) ->> 'budget_amount', '') IS NOT NULL
      ORDER BY o.id, e.escalation_timestamp DESC
    ),
    snaps AS (
      ${snapshot
        ? sql`SELECT contact_wa_id, qualification_snapshot_json -> 'selected_price_range' AS price_range
              FROM automation.session_memory
              WHERE contact_wa_id IN (SELECT contact_wa_id FROM persons)`
        : sql`SELECT NULL::text AS contact_wa_id, NULL::jsonb AS price_range WHERE false`}
    ),
    events AS (
      -- Exact per opportunity, plus the person-level ones that happened
      -- while this opportunity was alive.
      SELECT o.id,
             MAX(ev.occurred_at) FILTER (WHERE ev.kind = ANY(${[...ACTIVITY_EVENT_KINDS]}::text[])) AS last_crm_activity_at,
             MAX(ev.occurred_at) FILTER (WHERE ev.kind = 'contact') AS last_contact_event_at
      FROM opps o
      JOIN dashboard.lead_events ev
        ON ev.opportunity_id = o.id
        OR (ev.opportunity_id IS NULL
            AND ev.contact_wa_id = o.contact_wa_id
            AND ev.occurred_at >= o.opened_at
            AND (o.closed_at IS NULL OR ev.occurred_at < o.closed_at))
      GROUP BY o.id
    ),
    last_inbound AS (
      SELECT DISTINCT ON (contact_wa_id) contact_wa_id, intent
      FROM automation.lead_log
      WHERE direction = 'inbound'
        AND contact_wa_id IN (SELECT contact_wa_id FROM persons)
        AND NULLIF(intent, '') IS NOT NULL
      ORDER BY contact_wa_id, log_timestamp DESC, id DESC
    ),
    new_intent AS (
      -- An enquiry about a rubro nobody has open: the hint, not an opening.
      SELECT li.contact_wa_id, im.kind
      FROM last_inbound li
      JOIN intent_map im ON im.raw = li.intent
      WHERE NOT EXISTS (
        SELECT 1 FROM dashboard.opportunities o
        WHERE o.contact_wa_id = li.contact_wa_id
          AND o.closed_at IS NULL
          AND (o.kind = im.kind OR o.kind = '')
      )
    )
    SELECT
      o.id, o.contact_wa_id, o.seq, o.kind, o.title, o.opened_at, o.opened_by, o.closed_at,
      o.stage, o.stage_changed_at, o.lost_reason, o.owner_email,
      o.next_action_at, o.next_action_note, o.next_action_done_at, o.priority,
      o.budget_amount AS manual_budget_amount, o.budget_currency AS manual_budget_currency,
      (SELECT COUNT(*)::int FROM dashboard.opportunities t WHERE t.contact_wa_id = o.contact_wa_id) AS of_total,
      n.display_name, n.source, n.created_by, n.created_at, n.first_seen_at,
      m.first_seen, m.last_message_at, m.last_human_log_at,
      h.last_handoff_at, COALESCE(h.handoff_count, 0) AS handoff_count,
      b.budget_amount, b.budget_currency, sn.price_range,
      e.last_crm_activity_at, e.last_contact_event_at,
      ni.kind AS new_intent,
      ${suppression
        ? sql`(SELECT MIN(s.created_at) FROM outreach.suppression s WHERE s.wa_id = o.contact_wa_id)`
        : sql`NULL::timestamptz`} AS opted_out_at
    FROM opps o
    JOIN names n ON n.contact_wa_id = o.contact_wa_id
    LEFT JOIN msgs m ON m.id = o.id
    LEFT JOIN handoffs h ON h.id = o.id
    LEFT JOIN budgets b ON b.id = o.id
    LEFT JOIN snaps sn ON sn.contact_wa_id = o.contact_wa_id
    LEFT JOIN events e ON e.id = o.id
    LEFT JOIN new_intent ni ON ni.contact_wa_id = o.contact_wa_id
  `;

  return rows.map((r) => {
    const openedAt = new Date(r.opened_at as string | Date);
    const signals: LeadSignals = {
      firstSeen: toDate(r.first_seen),
      lastMessageAt: toDate(r.last_message_at),
      lastHandoffAt: toDate(r.last_handoff_at),
      lastHumanContactAt:
        [toDate(r.last_human_log_at), toDate(r.last_contact_event_at)]
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
      optedOutAt: toDate(r.opted_out_at),
      lastCrmActivityAt: toDate(r.last_crm_activity_at),
    };
    const state: LeadStateRow = {
      stage: r.stage === null ? null : String(r.stage),
      stageChangedAt: toDate(r.stage_changed_at),
      lostReason: String(r.lost_reason ?? ""),
      ownerEmail: r.owner_email === null ? null : String(r.owner_email),
      nextActionAt: toDate(r.next_action_at),
      nextActionNote: String(r.next_action_note ?? ""),
      nextActionDoneAt: toDate(r.next_action_done_at),
      priority: String(r.priority ?? ""),
      openedAt,
      closedAt: toDate(r.closed_at),
    };
    return {
      id: Number(r.id),
      contactWaId: String(r.contact_wa_id),
      seq: Number(r.seq),
      ofTotal: Number(r.of_total ?? 1),
      kind: String(r.kind ?? ""),
      title: String(r.title ?? ""),
      openedAt,
      openedBy: String(r.opened_by ?? ""),
      closedAt: state.closedAt,
      displayName: String(r.display_name),
      firstSeen: signals.firstSeen,
      lastMessageAt: signals.lastMessageAt,
      handoffCount: Number(r.handoff_count ?? 0),
      budget: toBudget(
        r.manual_budget_amount,
        r.manual_budget_currency,
        r.budget_amount,
        r.budget_currency,
        r.price_range,
      ),
      contact: {
        source: String(r.source ?? "whatsapp"),
        createdBy: String(r.created_by ?? ""),
        createdAt: new Date(r.created_at as string | Date),
        firstSeenAt: toDate(r.first_seen_at),
      },
      newIntent: r.new_intent === null || r.new_intent === undefined ? null : String(r.new_intent),
      lead: deriveLead(signals, state, config, now),
    };
  });
}

export type LeadListFilter = "today" | "at_risk" | "overdue" | "unassigned";

export const LEAD_LIST_FILTERS: ReadonlyArray<LeadListFilter> = [
  "today",
  "at_risk",
  "overdue",
  "unassigned",
];

export type LeadViewer = { email: string; isAdmin: boolean };

/**
 * "Hoy": what this person should act on today — their opportunities with a
 * reminder overdue or due today, theirs about to be lost, and unassigned ones
 * still in the bot's early stages (someone has to pick them up). An admin's
 * "their" is everyone's. Pure.
 */
export function isTodayLead(
  row: OpportunityRow,
  viewer: LeadViewer,
  config: CrmConfig,
  now: Date,
  timezone: string,
): boolean {
  const lead = row.lead;
  if (lead.lost) return false;
  const mine = viewer.isAdmin || lead.owner === viewer.email;
  const kind = attentionKind(lead, now, timezone);
  if (mine && (kind === "overdue" || kind === "today" || lead.atRisk !== null)) return true;
  return (
    lead.owner === null &&
    (lead.stage === config.autoStages.new || lead.stage === config.autoStages.qualified)
  );
}

/** Board/list order: what needs attention first, then priority, then recency. */
export function compareLeads(
  a: OpportunityRow,
  b: OpportunityRow,
  now: Date,
  timezone: string,
): number {
  return (
    attentionRank(a.lead, now, timezone) - attentionRank(b.lead, now, timezone) ||
    priorityRank(a.lead.priority) - priorityRank(b.lead.priority) ||
    (b.lead.lastActivityAt?.getTime() ?? 0) - (a.lead.lastActivityAt?.getTime() ?? 0)
  );
}

export type ListLeadsParams = {
  stage?: string;
  owner?: string; // email; "none" = unassigned
  filter?: LeadListFilter;
  q?: string;
  // Lost opportunities pile up (every idle one ends there), so they are hidden
  // unless the stage filter asks for them explicitly.
  includeLost?: boolean;
  priority?: CrmPriorityKey | "none";
  // Vertical intent key ("Ventas"); matched against the opportunity's rubro.
  intent?: string;
  // Who is looking (for the "today" filter and its count).
  viewer?: LeadViewer;
};

export type ListLeadsResult = {
  rows: OpportunityRow[];
  // Per-stage counts over the unfiltered-by-stage set, for the stage chips
  // and the board column headers.
  stageCounts: Record<string, number>;
  // Size of the viewer's "Hoy" set over every opportunity, 0 without a viewer.
  todayCount: number;
};

function matchesQuery(row: OpportunityRow, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return row.displayName.toLowerCase().includes(term) || row.contactWaId.includes(term);
}

export async function listLeads(
  config: CrmConfig,
  params: ListLeadsParams,
  now: Date,
): Promise<ListLeadsResult> {
  await syncOpportunities(config);
  const all = await selectOpportunityRows(config, now);
  const lostKey = config.autoStages.lost;
  const timezone = tenantConfig().timezone;
  const viewer = params.viewer;
  const todayCount = viewer
    ? all.filter((r) => isTodayLead(r, viewer, config, now, timezone)).length
    : 0;

  const base = all.filter((row) => {
    if (params.filter === "today" && (!viewer || !isTodayLead(row, viewer, config, now, timezone)))
      return false;
    if (params.owner === "none" && row.lead.owner !== null) return false;
    if (params.owner && params.owner !== "none" && row.lead.owner !== params.owner) return false;
    if (params.filter === "at_risk" && !row.lead.atRisk) return false;
    if (params.filter === "overdue" && row.lead.reminder?.status !== "overdue") return false;
    if (params.filter === "unassigned" && row.lead.owner !== null) return false;
    if (params.priority === "none" && row.lead.priority !== null) return false;
    if (params.priority && params.priority !== "none" && row.lead.priority !== params.priority)
      return false;
    if (params.intent && row.kind !== params.intent) return false;
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
    // One sort for the board and the list: attention first, then priority,
    // then recency (see compareLeads).
    .sort((a, b) => compareLeads(a, b, now, timezone));

  return { rows, stageCounts, todayCount };
}

/** One opportunity by its id. */
export async function getOpportunity(
  config: CrmConfig,
  id: number,
  now: Date,
): Promise<OpportunityRow | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await selectOpportunityRows(config, now, { ids: [id] });
  return rows[0] ?? null;
}

/** The person and every opportunity they have had. */
export type PersonRow = {
  contactWaId: string;
  displayName: string;
  contact: ContactInfo;
  optedOutAt: Date | null;
  // Rubro of a recent enquiry nobody is working, for the "Sin derivar" and
  // "Consulta nueva" hints.
  newIntent: string | null;
  opportunities: OpportunityRow[]; // open first, then newest
};

export async function getPerson(
  config: CrmConfig,
  waId: string,
  now: Date,
): Promise<PersonRow | null> {
  await syncOpportunities(config, [waId]);
  const [rows, contact] = await Promise.all([
    selectOpportunityRows(config, now, { waIds: [waId] }),
    sql<Record<string, unknown>[]>`
      SELECT c.contact_wa_id, c.display_name, c.source, c.created_by, c.created_at, c.first_seen_at,
             (SELECT COALESCE(NULLIF(MAX(l.lead_name), ''), NULLIF(MAX(l.profile_name), ''))
                FROM automation.lead_log l WHERE l.contact_wa_id = c.contact_wa_id) AS wa_name
      FROM dashboard.contacts c
      WHERE c.contact_wa_id = ${waId}
    `,
  ]);

  const head = contact[0];
  if (!head && rows.length === 0) return null;

  // Opening order, oldest first: the list reads like the history it is, and
  // the ordinal on each row matches its position ("2ª" is the second row).
  const opportunities = [...rows].sort((a, b) => a.seq - b.seq);

  if (!head) {
    const first = opportunities[0]!;
    return {
      contactWaId: first.contactWaId,
      displayName: first.displayName,
      contact: first.contact,
      optedOutAt: first.lead.lost?.reason === "opt_out" ? first.lead.lost.at : null,
      newIntent: first.newIntent,
      opportunities,
    };
  }

  return {
    contactWaId: String(head.contact_wa_id),
    displayName:
      String(head.display_name ?? "") ||
      String(head.wa_name ?? "") ||
      String(head.contact_wa_id),
    contact: {
      source: String(head.source ?? "whatsapp"),
      createdBy: String(head.created_by ?? ""),
      createdAt: new Date(head.created_at as string | Date),
      firstSeenAt: toDate(head.first_seen_at),
    },
    optedOutAt: opportunities[0]?.lead.lost?.reason === "opt_out" ? opportunities[0].lead.lost.at : null,
    newIntent: opportunities[0]?.newIntent ?? null,
    opportunities,
  };
}

/**
 * Which opportunity the person's page opens on: the one asked for, else the
 * open one that needs attention today, else the newest open one, else the
 * newest. Pure.
 */
export function pickDefaultOpportunity(
  person: PersonRow,
  opParam: number | null,
  now: Date,
  timezone: string,
): OpportunityRow | null {
  const asked = opParam ? person.opportunities.find((o) => o.id === opParam) : undefined;
  if (asked) return asked;
  // The list is in opening order, so the default is chosen explicitly: what
  // needs attention today, else the newest open one, else the newest of all.
  const newestFirst = [...person.opportunities].sort(
    (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
  );
  const open = newestFirst.filter((o) => o.closedAt === null);
  const urgent = open.find((o) => {
    const kind = attentionKind(o.lead, now, timezone);
    return kind === "overdue" || kind === "today";
  });
  return urgent ?? open[0] ?? newestFirst[0] ?? null;
}

/** Rows grouped by person, keeping each group's best-ranked row first. */
export function groupByPerson(
  rows: ReadonlyArray<OpportunityRow>,
): Array<{ contactWaId: string; displayName: string; rows: OpportunityRow[] }> {
  const groups = new Map<string, { contactWaId: string; displayName: string; rows: OpportunityRow[] }>();
  for (const row of rows) {
    const hit = groups.get(row.contactWaId);
    if (hit) hit.rows.push(row);
    else
      groups.set(row.contactWaId, {
        contactWaId: row.contactWaId,
        displayName: row.displayName,
        rows: [row],
      });
  }
  // Inside a group the opportunities read in opening order, like the list on
  // the person's card.
  for (const g of groups.values()) g.rows.sort((a, b) => a.seq - b.seq);
  return [...groups.values()];
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
 * pass an owner email to count only that person's opportunities (asesor), or
 * null to count every one (admin).
 */
export async function getCrmAlerts(
  config: CrmConfig,
  ownerEmail: string | null,
  now: Date,
): Promise<CrmAlerts> {
  const key = ownerEmail ?? "*";
  const hit = alertsCache.get(key);
  if (hit && now.getTime() - hit.at < ALERTS_TTL_MS) return hit.value;

  const all = await selectOpportunityRows(config, now);
  const scoped = ownerEmail ? all.filter((r) => r.lead.owner === ownerEmail) : all;
  const value: CrmAlerts = {
    atRisk: scoped.filter((r) => r.lead.atRisk !== null).length,
    overdueReminders: scoped.filter((r) => r.lead.reminder?.status === "overdue").length,
  };
  alertsCache.set(key, { value, at: now.getTime() });
  return value;
}
