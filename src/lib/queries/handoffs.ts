// Read paths for the Handoffs page. Both queries hard-filter out
// `escalation_type` in (`'workflow_error'`, `'error'`) so n8n runtime errors
// never reach the UI. Production uses `'workflow_error'`; the dev/CI seed
// uses `'error'`. Everything else (`post_results_advisor`, `otras_handoff`,
// `owners_advisor`, `emprendimientos_advisor`, …) is a real customer-facing
// flow terminal.

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
  // v_handoff_summary already excludes runtime errors upstream; this query
  // trusts that view (escalation_type filtering happens inside the view).
  const rows = await sql<Record<string, unknown>[]>`
    SELECT
      handoff_target AS target,
      COALESCE(total_count, 0)::int AS count_all_time,
      COALESCE(last_24h_count, 0)::int AS count_24h
    FROM automation.v_handoff_summary
    ORDER BY last_24h_count DESC, total_count DESC
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
    SELECT
      id,
      contact_wa_id,
      COALESCE(NULLIF(lead_name, ''), NULLIF(profile_name, ''), contact_wa_id) AS display_name,
      handoff_target AS target,
      NULLIF(reason, '') AS reason,
      escalation_timestamp AS created_at
    FROM automation.escalations
    WHERE escalation_type NOT IN ('workflow_error', 'error')
    ORDER BY escalation_timestamp DESC
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
    WHERE escalation_type NOT IN ('workflow_error', 'error')
  `;
  return Number(rows[0]?.n ?? 0);
}
