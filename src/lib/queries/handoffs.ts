// Read paths for the Handoffs page. Both queries hard-filter to
// escalation_type = 'business' so error-handler rows from the n8n runtime
// (escalation_type = 'error') never reach the UI.

import { sql } from "@/db/client";

export type HandoffSummaryRow = {
  target: string;
  count_all_time: number;
  count_24h: number;
};

export type HandoffRow = {
  id: number;
  contactWaId: string;
  displayName: string | null;
  target: string;
  reason: string | null;
  createdAt: string;
};

export async function getHandoffSummary(): Promise<HandoffSummaryRow[]> {
  // v_handoff_summary already filters escalation_type = 'business' upstream,
  // but we still defend in case a tenant runs an older view definition.
  const rows = await sql<Record<string, unknown>[]>`
    SELECT target,
           COALESCE(count_all_time, 0)::int AS count_all_time,
           COALESCE(count_24h,      0)::int AS count_24h
    FROM automation.v_handoff_summary
    ORDER BY count_24h DESC, count_all_time DESC
  `;
  return rows.map((r) => ({
    target: String(r.target),
    count_all_time: Number(r.count_all_time ?? 0),
    count_24h: Number(r.count_24h ?? 0),
  }));
}

export async function listBusinessHandoffs(opts: {
  limit?: number;
  offset?: number;
}): Promise<HandoffRow[]> {
  const { limit = 50, offset = 0 } = opts;
  const rows = await sql<Record<string, unknown>[]>`
    SELECT id, contact_wa_id, display_name, target, reason, created_at
    FROM automation.escalations
    WHERE escalation_type = 'business'
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  return rows.map((r) => ({
    id: Number(r.id),
    contactWaId: String(r.contact_wa_id),
    displayName: r.display_name === null ? null : String(r.display_name),
    target: String(r.target),
    reason: r.reason === null ? null : String(r.reason),
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  }));
}

export async function countBusinessHandoffs(): Promise<number> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT COUNT(*)::int AS n
    FROM automation.escalations
    WHERE escalation_type = 'business'
  `;
  return Number(rows[0]?.n ?? 0);
}
