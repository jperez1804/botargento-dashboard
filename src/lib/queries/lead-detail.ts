// Per-lead reads for the CRM card on /conversations/[waId]: the activity
// history (dashboard.lead_events) and what the bot captured while qualifying
// (latest real handoff + session_memory snapshot).

import { sql } from "@/db/client";
import type { CrmConfig } from "@/config/verticals/_types";
import { hasSessionMemory } from "@/lib/crm/probes";
import { priceRangeText } from "@/lib/crm/price-range";
import { NON_BUSINESS_ESCALATION_TYPES } from "@/lib/queries/handoffs";

export type LeadEvent = {
  id: number;
  kind: string;
  body: string;
  occurredAt: Date;
  createdBy: string;
  metadata: Record<string, unknown>;
};

// jsonb may arrive parsed or as text depending on the parsers installed on the
// shared client (drizzle adjusts them); accept both.
function asObject(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

export async function listLeadEvents(waId: string, limit = 50): Promise<LeadEvent[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT id, kind, body, occurred_at, created_by, metadata
    FROM dashboard.lead_events
    WHERE contact_wa_id = ${waId}
    ORDER BY occurred_at DESC, id DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    kind: String(r.kind),
    body: String(r.body ?? ""),
    occurredAt: new Date(r.occurred_at as string | Date),
    createdBy: String(r.created_by ?? ""),
    metadata: asObject(r.metadata),
  }));
}

export type TeamLeadEvent = LeadEvent & { contactWaId: string; leadName: string };

/**
 * The team-wide Actividad feed: latest lead_events across every lead, newest
 * first, optionally narrowed to one kind and/or one person. Each row carries
 * the lead's name — typed by hand for manual leads, else the WhatsApp name.
 */
export async function listTeamLeadEvents(
  opts: { kind?: string; by?: string; limit?: number } = {},
): Promise<TeamLeadEvent[]> {
  const { kind, by, limit = 100 } = opts;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      ev.id, ev.contact_wa_id, ev.kind, ev.body, ev.occurred_at, ev.created_by, ev.metadata,
      COALESCE(
        NULLIF(ml.display_name, ''),
        (SELECT COALESCE(NULLIF(MAX(l.lead_name), ''), NULLIF(MAX(l.profile_name), ''))
           FROM automation.lead_log l WHERE l.contact_wa_id = ev.contact_wa_id),
        ev.contact_wa_id
      ) AS lead_name
    FROM dashboard.lead_events ev
    LEFT JOIN dashboard.manual_leads ml ON ml.contact_wa_id = ev.contact_wa_id
    WHERE true
      ${kind ? sql`AND ev.kind = ${kind}` : sql``}
      ${by ? sql`AND ev.created_by = ${by}` : sql``}
    ORDER BY ev.occurred_at DESC, ev.id DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    contactWaId: String(r.contact_wa_id),
    leadName: String(r.lead_name ?? r.contact_wa_id),
    kind: String(r.kind),
    body: String(r.body ?? ""),
    occurredAt: new Date(r.occurred_at as string | Date),
    createdBy: String(r.created_by ?? ""),
    metadata: asObject(r.metadata),
  }));
}

export type QualificationItem = {
  label: string;
  value: string;
  format: "text" | "money" | "links";
  currency: string;
};

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Structured snapshot values (the price range object) read as one line.
  if (typeof v === "object") return priceRangeText(v);
  return String(v).trim();
}

/**
 * Resolves the vertical's qualificationFields against the lead's latest real
 * handoff and its session snapshot. Both reads are defensive: escalation
 * columns go through to_jsonb (not every tenant has every column) and
 * session_memory is only queried when it exists.
 */
export async function getLeadQualification(
  config: CrmConfig,
  waId: string,
): Promise<QualificationItem[]> {
  const withSnapshot = await hasSessionMemory();
  const [escalationRows, snapshotRows] = await Promise.all([
    sql<{ data: Record<string, unknown> }[]>`
      SELECT to_jsonb(e) AS data
      FROM automation.escalations e
      WHERE e.contact_wa_id = ${waId}
        AND e.escalation_type NOT IN ${sql(NON_BUSINESS_ESCALATION_TYPES)}
      ORDER BY e.escalation_timestamp DESC
      LIMIT 1
    `,
    withSnapshot
      ? sql<{ data: Record<string, unknown> }[]>`
          SELECT qualification_snapshot_json AS data
          FROM automation.session_memory
          WHERE contact_wa_id = ${waId}
          LIMIT 1
        `
      : Promise.resolve([]),
  ]);

  const sources = {
    escalation: asObject(escalationRows[0]?.data),
    snapshot: asObject(snapshotRows[0]?.data),
  };

  const items: QualificationItem[] = [];
  for (const field of config.qualificationFields) {
    const data = sources[field.source];
    const raw = asText(data[field.key]);
    const value = field.valueLabels?.[raw.toLowerCase()] ?? raw;
    if (!value) continue;
    items.push({
      label: field.label,
      value,
      format: field.format ?? "text",
      currency: field.currencyKey ? asText(data[field.currencyKey]) : "",
    });
  }
  return items;
}
