// Read-side queries for the two-way inbox. automation.v_conversation_control
// exists ONLY on tenants that deployed the inbox schema — every caller must be
// gated behind inboxEnabled() (same pattern as the outreach.v_* views behind
// campaignsTab), and the view is deliberately NOT in REQUIRED_VIEWS.

import { sql } from "@/db/client";

export type ConversationControl = {
  mode: "bot" | "human";
  takenBy: string;
  takenAt: string | null;
  isHumanControlled: boolean;
};

export async function getConversationControl(waId: string): Promise<ConversationControl> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT mode, taken_by, taken_at, is_human_controlled
    FROM automation.v_conversation_control
    WHERE contact_wa_id = ${waId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return { mode: "bot", takenBy: "", takenAt: null, isHumanControlled: false };
  return {
    mode: String(r.mode) === "human" ? "human" : "bot",
    takenBy: String(r.taken_by ?? ""),
    takenAt: r.taken_at ? new Date(r.taken_at as string | Date).toISOString() : null,
    isHumanControlled: r.is_human_controlled === true,
  };
}

export type HumanControlledRow = {
  contactWaId: string;
  takenBy: string;
};

/**
 * All currently human-controlled conversations — drives the Tomada/Bot badge
 * on the /inbox list (one query for the whole list, not one per row).
 */
export async function listHumanControlled(): Promise<HumanControlledRow[]> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT contact_wa_id, taken_by
    FROM automation.v_conversation_control
    WHERE is_human_controlled = true
  `;
  return rows.map((r) => ({
    contactWaId: String(r.contact_wa_id),
    takenBy: String(r.taken_by ?? ""),
  }));
}

/**
 * Unread counts for a set of contacts, in ONE query: inbound lead_log rows
 * above each contact's dashboard.inbox_read_state.last_read_log_id (contacts
 * with no row count everything inbound). Cross-schema read is fine:
 * dashboard_app owns dashboard.* and has SELECT on automation.*.
 */
export async function getUnreadCounts(waIds: string[]): Promise<Map<string, number>> {
  if (waIds.length === 0) return new Map();
  const rows = await sql<Record<string, unknown>[]>`
    SELECT l.contact_wa_id, COUNT(*)::int AS unread
    FROM automation.lead_log l
    LEFT JOIN dashboard.inbox_read_state r ON r.contact_wa_id = l.contact_wa_id
    WHERE l.direction = 'inbound'
      AND l.contact_wa_id = ANY(${waIds})
      AND l.id > COALESCE(r.last_read_log_id, 0)
    GROUP BY l.contact_wa_id
  `;
  return new Map(rows.map((r) => [String(r.contact_wa_id), Number(r.unread ?? 0)]));
}

/**
 * Advances the read watermark for a conversation (WhatsApp semantics: opening
 * the thread marks it read). GREATEST() keeps it monotonic under races.
 * Writes dashboard.* only — the automation invariant holds.
 */
export async function markConversationRead(
  waId: string,
  upToLogId: number,
  email: string,
): Promise<void> {
  if (!Number.isFinite(upToLogId) || upToLogId <= 0) return;
  await sql`
    INSERT INTO dashboard.inbox_read_state (contact_wa_id, last_read_log_id, read_at, read_by)
    VALUES (${waId}, ${upToLogId}, NOW(), ${email})
    ON CONFLICT (contact_wa_id) DO UPDATE
    SET last_read_log_id = GREATEST(dashboard.inbox_read_state.last_read_log_id, EXCLUDED.last_read_log_id),
        read_at = NOW(),
        read_by = EXCLUDED.read_by
  `;
}

export type WindowState = {
  lastInboundAt: string | null;
  inWindow: boolean;
};

/**
 * 24h-window state for the composer, computed in SQL with the SAME predicate
 * the n8n webhook enforces server-side (this copy is UX, not enforcement).
 */
export async function getWindowState(waId: string): Promise<WindowState> {
  const rows = await sql<Record<string, unknown>[]>`
    SELECT MAX(log_timestamp) AS last_inbound_at,
           COALESCE(MAX(log_timestamp) >= NOW() - INTERVAL '24 hours', false) AS in_window
    FROM automation.lead_log
    WHERE contact_wa_id = ${waId} AND direction = 'inbound'
  `;
  const r = rows[0];
  return {
    lastInboundAt: r?.last_inbound_at
      ? new Date(r.last_inbound_at as string | Date).toISOString()
      : null,
    inWindow: r?.in_window === true,
  };
}
